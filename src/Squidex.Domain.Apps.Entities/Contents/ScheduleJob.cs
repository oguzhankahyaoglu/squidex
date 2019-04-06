﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschraenkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System;
using NodaTime;
using Squidex.Domain.Apps.Core.Contents;
using Squidex.Infrastructure;

namespace Squidex.Domain.Apps.Entities.Contents
{
    public sealed class ScheduleJob
    {
        public Guid Id { get; }

        public Status Status { get; }

        public RefToken ScheduledBy { get; }

        public Instant DueTime { get; }

        public ScheduleJob(Guid id, Status status, RefToken by, Instant due)
        {
            Id = id;
            ScheduledBy = by;
            Status = status;
            DueTime = due;
        }

        public static ScheduleJob Build(Status status, RefToken by, Instant due)
        {
            return new ScheduleJob(Guid.NewGuid(), status, by, due);
        }
    }
}
