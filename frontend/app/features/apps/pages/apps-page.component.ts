﻿/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import {Component, OnInit} from '@angular/core';
import {take} from 'rxjs/operators';

import {
    AppDto,
    AppsState,
    AuthService,
    DialogModel,
    FeatureDto,
    LocalStoreService,
    NewsService,
    OnboardingService, SchemasService, UIOptions,
    UIState
} from '@app/shared';
import {Router} from '@angular/router';

@Component({
    selector: 'sqx-apps-page',
    styleUrls: ['./apps-page.component.scss'],
    templateUrl: './apps-page.component.html'
})
export class AppsPageComponent implements OnInit {
    public addAppDialog = new DialogModel();
    public addAppTemplate = '';

    public onboardingDialog = new DialogModel();

    public newsFeatures: ReadonlyArray<FeatureDto>;
    public newsDialog = new DialogModel();

    public info: string;

    constructor(
        public readonly appsState: AppsState,
        private readonly schemasService: SchemasService,
        public readonly authState: AuthService,
        public readonly uiState: UIState,
        private readonly localStore: LocalStoreService,
        private readonly newsService: NewsService,
        private readonly onboardingService: OnboardingService,
        private readonly uiOptions: UIOptions,
        private readonly router: Router
    ) {
        if (uiOptions.get('showInfo')) {
            this.info = uiOptions.get('more.info');
        }
    }

    public ngOnInit() {
        const shouldShowOnboarding = this.onboardingService.shouldShow('dialog');

        this.appsState.apps.pipe(take(1))
            .subscribe(apps => {
                //if only 1 app authenticated, redirect to content page
                if (apps.length == 1) {
                    this.schemasService.getSchemas(apps[0].name).subscribe((sc) => {
                        //redirect to the first one if exists
                        if (sc && sc.items && sc.items.length > 0) {
                            let ordered = sc.items.sortedByString(s=> s.name);
                            this.router.navigate(['/app', apps[0].name, 'content', ordered[0].name]);
                        } else {
                            this.router.navigate(['/app', apps[0].name, 'content']);
                        }
                    });
                } else if (shouldShowOnboarding && apps.length === 0) {
                    this.onboardingService.disable('dialog');
                    this.onboardingDialog.show();
                } else if (!this.uiOptions.get('hideNews')) {
                    const newsVersion = this.localStore.getInt('squidex.news.version');

                    this.newsService.getFeatures(newsVersion)
                        .subscribe(result => {
                            if (result.version !== newsVersion) {
                                if (result.features.length > 0) {
                                    this.newsFeatures = result.features;
                                    this.newsDialog.show();
                                }

                                this.localStore.setInt('squidex.news.version', result.version);
                            }
                        });
                }
            });
    }

    public createNewApp(template: string) {
        this.addAppTemplate = template;
        this.addAppDialog.show();
    }

    public trackByApp(index: number, app: AppDto) {
        return app.id;
    }
}