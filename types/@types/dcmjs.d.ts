declare namespace dcmjs {
    export interface DictionaryEntry {
        tag: string;
        vr: string;
        name: string;
        vm: string;
        version: string;
    }

    export type VRType =
        | 'AE'
        | 'AS'
        | 'AT'
        | 'CS'
        | 'DA'
        | 'DS'
        | 'DT'
        | 'FD'
        | 'FL'
        | 'IS'
        | 'LO'
        | 'LT'
        | 'OB'
        | 'OD'
        | 'OF'
        | 'OW'
        | 'PN'
        | 'SH'
        | 'SL'
        | 'SQ'
        | 'SS'
        | 'ST'
        | 'TM'
        | 'UC'
        | 'UI'
        | 'UL'
        | 'UN'
        | 'UR'
        | 'US'
        | 'UT';

    export interface PersonValue {
        Alphabetic?: string;
        Ideographic?: string;
        Phonetic?: string;
    }

    type DictSubDictEntry = Record<string, DictEntry | undefined>;

    export type DictEntryValue =
        | DictSubDictEntry
        | PersonValue
        | number
        | object
        | string;

    export interface DictEntry {
        Value?: DictEntryValue[];
        _rawValue?: unknown;
        vr: VRType;
    }

    export type Dict = Record<string, DictEntry | undefined>;

    export class DicomDict {
        constructor(meta: any);

        meta: any;
        dict: Dict;

        upsertTag(tag: string, vr: any, values: unknown): void;

        write(writeOptions?: { allowInvalidVRLength: boolean }): ArrayBuffer;
    }
}

declare module 'dcmjs' {
    export namespace data {
        export class DicomMetaDictionary {
            static punctuateTag(rawTag: string): string;

            static unpunctuateTag(tag: string): string;

            static parseIntFromTag(tag: number | string): number;

            static tagAsIntegerFromName(name: string): number | undefined;

            static cleanDataset(dataset: dcmjs.Dict): dcmjs.Dict;

            static namifyDataset(dataset: dcmjs.Dict): dcmjs.Dict;

            /** converts from DICOM JSON Model dataset to a natural dataset
             * - sequences become lists
             * - single element lists are replaced by their first element,
             *     with single element lists remaining lists, but being a
             *     proxy for the child values, see addAccessors for examples
             * - object member names are dictionary, not group/element tag
             */
            static naturalizeDataset(
                dataset: dcmjs.Dict,
            ): Record<string, unknown>;

            static denaturalizeValue(
                naturalValue: unknown[] | unknown,
            ): string[];

            static denaturalizeDataset(
                dataset: Record<string, unknown>,
                nameMap?: Record<string, dcmjs.DictionaryEntry>,
            ): dcmjs.Dict;

            static uid(): string;

            static date(): string;

            static time(): string;

            static dateTime(): string;

            static _generateNameMap(): void;

            static _generateCustomNameMap(
                dictionary: Record<string, dcmjs.DictionaryEntry>,
            ): Record<string, dcmjs.DictionaryEntry>;

            static _generateUIDMap(): void;

            constructor(
                customDictionary: Record<string, dcmjs.DictionaryEntry>,
            );

            customDictionary: Record<string, dcmjs.DictionaryEntry>;
            customNameMap: Record<string, dcmjs.DictionaryEntry>;

            denaturalizeDataset(dataset: Record<string, unknown>): dcmjs.Dict;
        }
    }
}

export = dcmjs;
