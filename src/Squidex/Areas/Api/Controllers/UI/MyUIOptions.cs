﻿// ==========================================================================
//  Squidex Headless CMS
// ==========================================================================
//  Copyright (c) Squidex UG (haftungsbeschränkt)
//  All rights reserved. Licensed under the MIT license.
// ==========================================================================

using System.Collections.Generic;

namespace Squidex.Areas.Api.Controllers.UI
{
    public sealed class MyUIOptions
    {
        public Dictionary<string, string> RegexSuggestions { get; set; }

        public MapOptions Map { get; set; }

        public bool OnlyAdminsCanCreateApps { get; set; }

        public sealed class MapOptions
        {
            public string Type { get; set; }

            public MapGoogleOptions GoogleMaps { get; set; }
        }

        public sealed class MapGoogleOptions
        {
            public string Key { get; set; }
        }
    }
}
