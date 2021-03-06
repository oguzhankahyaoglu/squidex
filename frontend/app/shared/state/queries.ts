/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { compareStrings } from '@app/framework';

import {
    decodeQuery,
    equalsQuery,
    Query
} from './query';

import { UIState } from './ui.state';

export interface SavedQuery {
    // The optional color.
    color?: string;

    // The name of the query.
    name: string;

    // The deserialized value.
    query?: Query;
}

const OLDEST_FIRST: Query = {
    sort: [
        { path: 'lastModified', order: 'ascending' }
    ]
};
const NEWEST_FIRST: Query = {
    sort: [
        { path: 'lastModified', order: 'descending' }
    ]
};

export class Queries {
    public queries: Observable<ReadonlyArray<SavedQuery>>;
    public queriesShared: Observable<ReadonlyArray<SavedQuery>>;
    public queriesUser: Observable<ReadonlyArray<SavedQuery>>;

    public defaultQueries: ReadonlyArray<SavedQuery> = [
        { name: 'All (by order no)' },
        { name: 'All (newest first)', query: NEWEST_FIRST },
        { name: 'All (oldest first)', query: OLDEST_FIRST }
    ];

    constructor(
        private readonly uiState: UIState,
        private readonly prefix: string
    ) {
        const path = `${prefix}.queries`;

        this.queries = this.uiState.get(path, {}).pipe(
            map(settings => parseQueries(settings)), shareReplay(1));

        this.queriesShared = this.uiState.getShared(path, {}).pipe(
            map(settings => parseQueries(settings)), shareReplay(1));

        this.queriesUser = this.uiState.getUser(path, {}).pipe(
            map(settings => parseQueries(settings)), shareReplay(1));
    }

    public add(key: string, query: Query, user = false) {
        this.uiState.set(this.getPath(key), JSON.stringify(query), user);
    }

    public removeShared(saved: SavedQuery) {
        this.uiState.removeShared(this.getPath(saved.name));
    }

    public removeUser(saved: SavedQuery) {
        this.uiState.removeUser(this.getPath(saved.name));
    }

    public remove(saved: SavedQuery) {
        this.uiState.remove(this.getPath(saved.name));
    }

    private getPath(key: string): string {
        return `${this.prefix}.queries.${key}`;
    }

    public getSaveKey(query: Query): Observable<string | undefined> {
        return this.queries.pipe(
            map(queries => {
                for (const saved of queries) {
                    if (equalsQuery(saved.query, query)) {
                        return saved.name;
                    }
                }

                return undefined;
            }));
    }
}

function parseQueries(settings: {}) {
    let queries = Object.keys(settings).map(name => parseStored(name, settings[name]));

    return queries.sort((a, b) => compareStrings(a.name, b.name));
}

export function parseStored(name: string, raw?: string) {
    const query = decodeQuery(raw);

    return { name, query };
}