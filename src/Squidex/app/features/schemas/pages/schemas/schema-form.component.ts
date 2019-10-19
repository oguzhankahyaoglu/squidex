/*
 * Squidex Headless CMS
 *
 * @license
 * Copyright (c) Squidex UG (haftungsbeschränkt). All rights reserved.
 */

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder } from '@angular/forms';

import {
    ApiUrlConfig,
    AppsState,
    CreateSchemaForm,
    SchemaDto,
    SchemasState
} from '@app/shared';

@Component({
    selector: 'sqx-schema-form',
    styleUrls: ['./schema-form.component.scss'],
    templateUrl: './schema-form.component.html'
})
export class SchemaFormComponent implements OnInit {
    @Output()
    public complete = new EventEmitter<SchemaDto>();

    @Output()
    public cancel = new EventEmitter();

    @Input()
    public import: any;

    public createForm = new CreateSchemaForm(this.formBuilder);

    public showImport = false;

    constructor(
        public readonly apiUrl: ApiUrlConfig,
        public readonly appsState: AppsState,
        private readonly formBuilder: FormBuilder,
        private readonly schemasState: SchemasState
    ) {
    }

    public ngOnInit() {
        this.createForm.load({ name: '', import: this.import });

        this.showImport = !!this.import;
    }

    public toggleImport() {
        this.showImport = !this.showImport;

        return false;
    }

    public emitComplete(value: SchemaDto) {
        this.complete.emit(value);
    }

    public emitCancel() {
        this.cancel.emit();
    }

    public createSchema() {
        const value = this.createForm.submit();

        if (value) {
            const schemaDto = Object.assign(value.import || {}, { name: value.name, isSingleton: value.isSingleton });

            this.schemasState.create(schemaDto)
                .subscribe(dto => {
                    this.emitComplete(dto);
                }, error => {
                    this.createForm.submitFailed(error);
                });
        }
    }
}