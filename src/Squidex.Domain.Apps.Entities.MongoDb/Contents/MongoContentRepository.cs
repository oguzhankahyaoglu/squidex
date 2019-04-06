﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschränkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;
using NodaTime;
using Squidex.Domain.Apps.Core.Contents;
using Squidex.Domain.Apps.Entities.Apps;
using Squidex.Domain.Apps.Entities.Contents;
using Squidex.Domain.Apps.Entities.Contents.Repositories;
using Squidex.Domain.Apps.Entities.Contents.Text;
using Squidex.Domain.Apps.Entities.Schemas;
using Squidex.Domain.Apps.Events.Assets;
using Squidex.Domain.Apps.Events.Contents;
using Squidex.Infrastructure;
using Squidex.Infrastructure.Json;
using Squidex.Infrastructure.Log;
using Squidex.Infrastructure.Queries;

namespace Squidex.Domain.Apps.Entities.MongoDb.Contents
{
    public partial class MongoContentRepository : IContentRepository, IInitializable
    {
        private readonly IMongoDatabase database;
        private readonly IAppProvider appProvider;
        private readonly IJsonSerializer serializer;
        private readonly ITextIndexer indexer;
        private readonly string typeAssetDeleted;
        private readonly string typeContentDeleted;
        private readonly MongoContentCollection contents;

        public MongoContentRepository(IMongoDatabase database, IAppProvider appProvider, IJsonSerializer serializer, ITextIndexer indexer, TypeNameRegistry typeNameRegistry)
        {
            Guard.NotNull(appProvider, nameof(appProvider));
            Guard.NotNull(database, nameof(database));
            Guard.NotNull(serializer, nameof(serializer));
            Guard.NotNull(indexer, nameof(indexer));
            Guard.NotNull(typeNameRegistry, nameof(typeNameRegistry));

            this.appProvider = appProvider;
            this.database = database;
            this.indexer = indexer;
            this.serializer = serializer;

            typeAssetDeleted = typeNameRegistry.GetName<AssetDeleted>();
            typeContentDeleted = typeNameRegistry.GetName<ContentDeleted>();

            contents = new MongoContentCollection(database, serializer, appProvider);
        }

        public Task InitializeAsync(CancellationToken ct = default)
        {
            return contents.InitializeAsync(ct);
        }

        public async Task<IResultList<IContentEntity>> QueryAsync(IAppEntity app, ISchemaEntity schema, Status[] status, Query query)
        {
            Guard.NotNull(app, nameof(app));
            Guard.NotNull(schema, nameof(schema));
            Guard.NotNull(status, nameof(status));
            Guard.NotNull(query, nameof(query));

            using (Profiler.TraceMethod<MongoContentRepository>("QueryAsyncByQuery"))
            {
                var useDraft = UseDraft(status);

                var fullTextIds = await indexer.SearchAsync(query.FullText, app, schema.Id, useDraft ? Scope.Draft : Scope.Published);

                if (fullTextIds?.Count == 0)
                {
                    return ResultList.Create<IContentEntity>(0);
                }

                return await contents.QueryAsync(app, schema, query, fullTextIds, status, true);
            }
        }

        public async Task<IResultList<IContentEntity>> QueryAsync(IAppEntity app, ISchemaEntity schema, Status[] status, HashSet<Guid> ids)
        {
            Guard.NotNull(app, nameof(app));
            Guard.NotNull(schema, nameof(schema));
            Guard.NotNull(status, nameof(status));
            Guard.NotNull(ids, nameof(ids));

            using (Profiler.TraceMethod<MongoContentRepository>("QueryAsyncByIds"))
            {
                var useDraft = UseDraft(status);

                return await contents.QueryAsync(app, schema, ids, status, useDraft);
            }
        }

        public async Task<List<(IContentEntity Content, ISchemaEntity Schema)>> QueryAsync(IAppEntity app, Status[] status, HashSet<Guid> ids)
        {
            Guard.NotNull(app, nameof(app));
            Guard.NotNull(status, nameof(status));
            Guard.NotNull(ids, nameof(ids));

            using (Profiler.TraceMethod<MongoContentRepository>("QueryAsyncByIdsWithoutSchema"))
            {
                var useDraft = UseDraft(status);

                return await contents.QueryAsync(app, ids, status, useDraft);
            }
        }

        public async Task<IContentEntity> FindContentAsync(IAppEntity app, ISchemaEntity schema, Status[] status, Guid id)
        {
            Guard.NotNull(app, nameof(app));
            Guard.NotNull(schema, nameof(schema));
            Guard.NotNull(status, nameof(status));

            using (Profiler.TraceMethod<MongoContentRepository>())
            {
                var useDraft = UseDraft(status);

                return await contents.FindContentAsync(app, schema, id, status, useDraft);
            }
        }

        public async Task<IReadOnlyList<Guid>> QueryIdsAsync(Guid appId, Guid schemaId, FilterNode filterNode)
        {
            using (Profiler.TraceMethod<MongoContentRepository>())
            {
                return await contents.QueryIdsAsync(appId, await appProvider.GetSchemaAsync(appId, schemaId), filterNode);
            }
        }

        public async Task<IReadOnlyList<Guid>> QueryIdsAsync(Guid appId)
        {
            using (Profiler.TraceMethod<MongoContentRepository>())
            {
                return await contents.QueryIdsAsync(appId);
            }
        }

        public async Task QueryScheduledWithoutDataAsync(Instant now, Func<IContentEntity, Task> callback)
        {
            using (Profiler.TraceMethod<MongoContentRepository>())
            {
                await contents.QueryScheduledWithoutDataAsync(now, callback);
            }
        }

        public Task ClearAsync()
        {
            return contents.ClearAsync();
        }

        public Task DeleteArchiveAsync()
        {
            return database.DropCollectionAsync("States_Contents_Archive");
        }

        private static bool UseDraft(Status[] status)
        {
            return status.Length != 1 || status[0] != Status.Published;
        }
    }
}
