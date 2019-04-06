/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import { HttpClient, HttpErrorResponse, HttpEventType, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';

import {
    AnalyticsService,
    ApiUrlConfig,
    DateTime,
    ErrorDto,
    HTTP,
    Model,
    pretifyError,
    Types,
    Version,
    Versioned
} from '@app/framework';

export class AssetsDto extends Model {
    constructor(
        public readonly total: number,
        public readonly items: AssetDto[]
    ) {
        super();
    }
}

export class AssetDto extends Model {
    public get canPreview() {
        return this.isImage || (this.mimeType === 'image/svg+xml' && this.fileSize < 100 * 1024);
    }

    constructor(
        public readonly id: string,
        public readonly createdBy: string,
        public readonly lastModifiedBy: string,
        public readonly created: DateTime,
        public readonly lastModified: DateTime,
        public readonly fileName: string,
        public readonly fileType: string,
        public readonly fileSize: number,
        public readonly fileVersion: number,
        public readonly mimeType: string,
        public readonly isImage: boolean,
        public readonly pixelWidth: number | null,
        public readonly pixelHeight: number | null,
        public readonly slug: string,
        public readonly tags: string[],
        public readonly url: string,
        public readonly version: Version
    ) {
        super();
    }

    public with(value: Partial<AssetDto>, validOnly = false): AssetDto {
        return this.clone(value, validOnly);
    }

    public update(update: AssetReplacedDto, user: string, version: Version, now?: DateTime): AssetDto {
        return this.with({
            ...update,
            lastModified: now || DateTime.now(),
            lastModifiedBy: user,
            version
        });
    }

    public annnotate(update: AnnotateAssetDto, user: string, version: Version, now?: DateTime): AssetDto {
        return this.with({
            ...<any>update,
            lastModified: now || DateTime.now(),
            lastModifiedBy: user,
            version
        }, true);
    }
}

export class AnnotateAssetDto {
    constructor(
        public readonly fileName: string | null,
        public readonly slug: string | null,
        public readonly tags: string[] | null
    ) {
    }
}

export class AssetReplacedDto {
    constructor(
        public readonly fileSize: number,
        public readonly fileVersion: number,
        public readonly mimeType: string,
        public readonly isImage: boolean,
        public readonly pixelWidth: number | null,
        public readonly pixelHeight: number | null
    ) {
    }
}

@Injectable()
export class AssetsService {
    constructor(
        private readonly http: HttpClient,
        private readonly apiUrl: ApiUrlConfig,
        private readonly analytics: AnalyticsService
    ) {
    }

    public getTags(appName: string): Observable<{ [name: string]: number }> {
        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets/tags`);

        return HTTP.getVersioned(this.http, url).pipe(
                map(response => <any>response.payload.body));
    }

    public getAssets(appName: string, take: number, skip: number, query?: string, tags?: string[], ids?: string[]): Observable<AssetsDto> {
        let fullQuery = '';

        if (ids) {
            fullQuery = `ids=${ids.join(',')}`;
        } else {
            const queries: string[] = [];

            const filters: string[] = [];

            if (query && query.length > 0) {
                filters.push(`contains(fileName,'${encodeURIComponent(query)}')`);
            }

            if (tags) {
                for (let tag of tags) {
                    if (tag && tag.length > 0) {
                        filters.push(`tags eq '${encodeURIComponent(tag)}'`);
                    }
                }
            }

            if (filters.length > 0) {
                queries.push(`$filter=${filters.join(' and ')}`);
            }

            queries.push(`$top=${take}`);
            queries.push(`$skip=${skip}`);

            fullQuery = queries.join('&');
        }

        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets?${fullQuery}`);

        return HTTP.getVersioned<any>(this.http, url).pipe(
                map(response => {
                    const body = response.payload.body;

                    const items: any[] = body.items;

                    return new AssetsDto(body.total, items.map(item => {
                        const assetUrl = this.apiUrl.buildUrl(`api/assets/${item.id}`);

                        return new AssetDto(
                            item.id,
                            item.createdBy,
                            item.lastModifiedBy,
                            DateTime.parseISO_UTC(item.created),
                            DateTime.parseISO_UTC(item.lastModified),
                            item.fileName,
                            item.fileType,
                            item.fileSize,
                            item.fileVersion,
                            item.mimeType,
                            item.isImage,
                            item.pixelWidth,
                            item.pixelHeight,
                            item.slug,
                            item.tags || [],
                            assetUrl,
                            new Version(item.version.toString()));
                    }));
                }),
                pretifyError('Failed to load assets. Please reload.'));
    }

    public uploadFile(appName: string, file: File, user: string, now: DateTime): Observable<number | AssetDto> {
        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets`);

        const req = new HttpRequest('POST', url, getFormData(file), { reportProgress: true });

        return this.http.request<any>(req).pipe(
                filter(event =>
                     event.type === HttpEventType.UploadProgress ||
                     event.type === HttpEventType.Response),
                map(event => {
                    if (event.type === HttpEventType.UploadProgress) {
                        const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;

                        return percentDone;
                    } else if (Types.is(event, HttpResponse)) {
                        const response: any = event.body;
                        const assetUrl = this.apiUrl.buildUrl(`api/assets/${response.id}`);

                        now = now || DateTime.now();

                        const dto =  new AssetDto(
                            response.id,
                            user,
                            user,
                            now,
                            now,
                            response.fileName,
                            response.fileType,
                            response.fileSize,
                            response.fileVersion,
                            response.mimeType,
                            response.isImage,
                            response.pixelWidth,
                            response.pixelHeight,
                            response.slug,
                            response.tags || [],
                            assetUrl,
                            new Version(event.headers.get('etag')!));

                        return dto;
                    } else {
                        throw 'Invalid';
                    }
                }),
                catchError((error: any) => {
                    if (Types.is(error, HttpErrorResponse) && error.status === 413) {
                        return throwError(new ErrorDto(413, 'Asset is too big.'));
                    } else {
                        return throwError(error);
                    }
                }),
                tap(value => {
                    if (!Types.isNumber(value)) {
                        this.analytics.trackEvent('Asset', 'Uploaded', appName);
                    }
                }),
                pretifyError('Failed to upload asset. Please reload.'));
    }

    public getAsset(appName: string, id: string): Observable<AssetDto> {
        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets/${id}`);

        return HTTP.getVersioned<any>(this.http, url).pipe(
                map(response => {
                    const body = response.payload.body;

                    const assetUrl = this.apiUrl.buildUrl(`api/assets/${body.id}`);

                    return new AssetDto(
                        body.id,
                        body.createdBy,
                        body.lastModifiedBy,
                        DateTime.parseISO_UTC(body.created),
                        DateTime.parseISO_UTC(body.lastModified),
                        body.fileName,
                        body.fileType,
                        body.fileSize,
                        body.fileVersion,
                        body.mimeType,
                        body.isImage,
                        body.pixelWidth,
                        body.pixelHeight,
                        body.slug,
                        body.tags || [],
                        assetUrl,
                        response.version);
                }),
                pretifyError('Failed to load assets. Please reload.'));
    }

    public replaceFile(appName: string, id: string, file: File, version: Version): Observable<number | Versioned<AssetReplacedDto>> {
        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets/${id}/content`);

        const req = new HttpRequest('PUT', url, getFormData(file), { headers: new HttpHeaders().set('If-Match', version.value), reportProgress: true });

        return this.http.request(req).pipe(
                filter(event =>
                    event.type === HttpEventType.UploadProgress ||
                    event.type === HttpEventType.Response),
                map(event => {
                    if (event.type === HttpEventType.UploadProgress) {
                        const percentDone = event.total ? Math.round(100 * event.loaded / event.total) : 0;

                        return percentDone;
                    } else if (Types.is(event, HttpResponse)) {
                        const response: any = event.body;

                        const replaced =  new AssetReplacedDto(
                            response.fileSize,
                            response.fileVersion,
                            response.mimeType,
                            response.isImage,
                            response.pixelWidth,
                            response.pixelHeight);

                        return new Versioned(new Version(event.headers.get('etag')!), replaced);
                    } else {
                        throw 'Invalid';
                    }
                }),
                catchError(error => {
                    if (Types.is(error, HttpErrorResponse) && error.status === 413) {
                        return throwError(new ErrorDto(413, 'Asset is too big.'));
                    } else {
                        return throwError(error);
                    }
                }),
                tap(value => {
                    if (!Types.isNumber(value)) {
                        this.analytics.trackEvent('Analytics', 'Replaced', appName);
                    }
                }),
                pretifyError('Failed to replace asset. Please reload.'));
    }

    public deleteAsset(appName: string, id: string, version: Version): Observable<Versioned<any>> {
        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets/${id}`);

        return HTTP.deleteVersioned(this.http, url, version).pipe(
                tap(() => {
                    this.analytics.trackEvent('Analytics', 'Deleted', appName);
                }),
                pretifyError('Failed to delete asset. Please reload.'));
    }

    public putAsset(appName: string, id: string, dto: AnnotateAssetDto, version: Version): Observable<Versioned<any>> {
        const url = this.apiUrl.buildUrl(`api/apps/${appName}/assets/${id}`);

        return HTTP.putVersioned(this.http, url, dto, version).pipe(
                tap(() => {
                    this.analytics.trackEvent('Analytics', 'Updated', appName);
                }),
                pretifyError('Failed to delete asset. Please reload.'));
    }
}

function getFormData(file: File) {
    const formData = new FormData();

    formData.append('file', file);

    return formData;
}