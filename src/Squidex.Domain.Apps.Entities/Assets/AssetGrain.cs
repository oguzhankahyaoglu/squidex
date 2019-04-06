﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschränkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Squidex.Domain.Apps.Core.Tags;
using Squidex.Domain.Apps.Entities.Assets.Commands;
using Squidex.Domain.Apps.Entities.Assets.Guards;
using Squidex.Domain.Apps.Entities.Assets.State;
using Squidex.Domain.Apps.Events;
using Squidex.Domain.Apps.Events.Assets;
using Squidex.Infrastructure;
using Squidex.Infrastructure.Commands;
using Squidex.Infrastructure.EventSourcing;
using Squidex.Infrastructure.Log;
using Squidex.Infrastructure.Orleans;
using Squidex.Infrastructure.Reflection;
using Squidex.Infrastructure.States;

namespace Squidex.Domain.Apps.Entities.Assets
{
    public sealed class AssetGrain : SquidexDomainObjectGrainLogSnapshots<AssetState>, IAssetGrain
    {
        private readonly ITagService tagService;

        public AssetGrain(IStore<Guid> store, ITagService tagService, ISemanticLog log)
            : base(store, log)
        {
            Guard.NotNull(tagService, nameof(tagService));

            this.tagService = tagService;
        }

        protected override Task<object> ExecuteAsync(IAggregateCommand command)
        {
            VerifyNotDeleted();

            switch (command)
            {
                case CreateAsset createRule:
                    return CreateReturnAsync(createRule, async c =>
                    {
                        GuardAsset.CanCreate(c);

                        c.Tags = await NormalizeTagsAsync(c.AppId.Id, c.Tags);

                        Create(c);

                        return new AssetSavedResult(Version, Snapshot.FileVersion);
                    });
                case UpdateAsset updateRule:
                    return UpdateAsync(updateRule, c =>
                    {
                        GuardAsset.CanUpdate(c);

                        Update(c);

                        return new AssetSavedResult(Version, Snapshot.FileVersion);
                    });
                case DeleteAsset deleteAsset:
                    return UpdateAsync(deleteAsset, async c =>
                    {
                        GuardAsset.CanDelete(c);

                        await tagService.NormalizeTagsAsync(Snapshot.AppId.Id, TagGroups.Assets, null, Snapshot.Tags);

                        Delete(c);
                    });
                case AnnotateAsset annotateAsset:
                    return UpdateAsync(annotateAsset, async c =>
                    {
                        GuardAsset.CanAnnotate(c, Snapshot.FileName, Snapshot.Slug);

                        if (c.Tags != null)
                        {
                            c.Tags = await NormalizeTagsAsync(Snapshot.AppId.Id, c.Tags);
                        }

                        Annotate(c);
                    });
                default:
                    throw new NotSupportedException();
            }
        }

        private async Task<HashSet<string>> NormalizeTagsAsync(Guid appId, HashSet<string> tags)
        {
            var normalized = await tagService.NormalizeTagsAsync(appId, TagGroups.Assets, tags, Snapshot.Tags);

            return new HashSet<string>(normalized.Values);
        }

        public void Create(CreateAsset command)
        {
            var @event = SimpleMapper.Map(command, new AssetCreated
            {
                FileName = command.File.FileName,
                FileSize = command.File.FileSize,
                FileVersion = 0,
                MimeType = command.File.MimeType,
                PixelWidth = command.ImageInfo?.PixelWidth,
                PixelHeight = command.ImageInfo?.PixelHeight,
                IsImage = command.ImageInfo != null,
                Slug = command.File.FileName.ToAssetSlug()
            });

            RaiseEvent(@event);
        }

        public void Update(UpdateAsset command)
        {
            VerifyNotDeleted();

            var @event = SimpleMapper.Map(command, new AssetUpdated
            {
                FileVersion = Snapshot.FileVersion + 1,
                FileSize = command.File.FileSize,
                MimeType = command.File.MimeType,
                PixelWidth = command.ImageInfo?.PixelWidth,
                PixelHeight = command.ImageInfo?.PixelHeight,
                IsImage = command.ImageInfo != null
            });

            RaiseEvent(@event);
        }

        public void Delete(DeleteAsset command)
        {
            RaiseEvent(SimpleMapper.Map(command, new AssetDeleted { DeletedSize = Snapshot.TotalSize }));
        }

        public void Annotate(AnnotateAsset command)
        {
            RaiseEvent(SimpleMapper.Map(command, new AssetAnnotated()));
        }

        private void RaiseEvent(AppEvent @event)
        {
            if (@event.AppId == null)
            {
                @event.AppId = Snapshot.AppId;
            }

            RaiseEvent(Envelope.Create(@event));
        }

        private void VerifyNotDeleted()
        {
            if (Snapshot.IsDeleted)
            {
                throw new DomainException("Asset has already been deleted");
            }
        }

        public Task<J<IAssetEntity>> GetStateAsync(long version = EtagVersion.Any)
        {
            return J.AsTask<IAssetEntity>(GetSnapshot(version));
        }
    }
}
