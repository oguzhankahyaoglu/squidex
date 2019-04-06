﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschränkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System;
using Squidex.Domain.Apps.Events.Assets;
using Squidex.Infrastructure;
using Squidex.Infrastructure.EventSourcing;

namespace Migrate_01.OldEvents
{
    [EventType(nameof(AssetRenamed))]
    [Obsolete]
    public sealed class AssetRenamed : AssetEvent, IMigrated<IEvent>
    {
        public string FileName { get; set; }

        public IEvent Migrate()
        {
            return new AssetAnnotated { FileName = FileName };
        }
    }
}
