/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import { of } from 'rxjs';
import { IMock, It, Mock, Times } from 'typemoq';

import {  AppsState } from '@app/shared';

import { UIService } from './../services/ui.service';
import { UIState } from './ui.state';

describe('UIState', () => {
    const app = 'my-app';

    const appSettings = {
        mapType: 'GM',
        mapSize: 1024,
        canCreateApps: true
    };

    const commonSettings = {
        mapType: 'OSM',
        mapKey: 'Key',
        canCreateApps: true
    };

    let appsState: IMock<AppsState>;
    let uiService: IMock<UIService>;
    let uiState: UIState;

    beforeEach(() => {
        appsState = Mock.ofType<AppsState>();

        appsState.setup(x => x.appName)
            .returns(() => app);

        appsState.setup(x => x.selectedApp)
            .returns(() => of(<any>{ name: app }));

        uiService = Mock.ofType<UIService>();

        uiService.setup(x => x.getSettings(app))
            .returns(() => of(appSettings));

        uiService.setup(x => x.getCommonSettings())
            .returns(() => of(commonSettings));

        uiService.setup(x => x.putSetting(app, It.isAnyString(), It.isAny()))
            .returns(() => of({}));

        uiService.setup(x => x.deleteSetting(app, It.isAnyString()))
            .returns(() => of({}));

        uiState = new UIState(appsState.object, uiService.object);
    });

    it('should load settings', () => {
        expect(uiState.snapshot.settings).toEqual({
            mapType: 'GM',
            mapKey: 'Key',
            mapSize: 1024,
            canCreateApps: true
        });
    });

    it('should add value to snapshot when set', () => {
        uiState.set('root.nested', 123);

        expect(uiState.snapshot.settings).toEqual({
            mapType: 'GM',
            mapKey: 'Key',
            mapSize: 1024,
            root: {
                nested: 123
            },
            canCreateApps: true
        });

        uiState.get('root', {}).subscribe(x => {
            expect(x).toEqual({ nested: 123 });
        });

        uiState.get('root.nested', 0).subscribe(x => {
            expect(x).toEqual(123);
        });

        uiState.get('root.notfound', 1337).subscribe(x => {
            expect(x).toEqual(1337);
        });

        uiService.verify(x => x.putSetting(app, 'root.nested', 123), Times.once());
    });

    it('should remove value from snapshot when removed', () => {
        uiState.set('root.nested1', 123);
        uiState.set('root.nested2', 123);
        uiState.remove('root.nested1');

        expect(uiState.snapshot.settings).toEqual({
            mapType: 'GM',
            mapKey: 'Key',
            mapSize: 1024,
            root: {
                nested2: 123
            },
            canCreateApps: true
        });

        uiState.get('root', {}).subscribe(x => {
            expect(x).toEqual({ nested2: 123 });
        });

        uiState.get('root.nested2', 0).subscribe(x => {
            expect(x).toEqual(123);
        });

        uiState.get('root.nested1', 1337).subscribe(x => {
            expect(x).toEqual(1337);
        });

        uiService.verify(x => x.deleteSetting(app, 'root.nested1'), Times.once());
    });
});