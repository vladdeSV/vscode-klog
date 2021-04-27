export interface KlogSettings {
    klogPath: string,
    validateOn: 'save' | 'edit',
}

export type KlogError = {
    line: number,
    column: number,
    length: number,
    title: string,
    details: string,
}

type EntryCommon = {
    summary: string,
    tags: string[],
    total: string,
    total_mins: number,
}

type EntryRangeOpen = {
    type: 'open_range'
    start: string,
    start_mins: number,
}

type EntryRange = {
    type: 'range'
    start: string,
    start_mins: number,
    end: string,
    end_mins: number,
}

type EntryDuration = {
    type: 'duration'
}

export type KlogEntry = EntryCommon | EntryRange | EntryRangeOpen | EntryDuration;

export type KlogRecord = {
    date: string,
    summary: string,
    total: string,
    total_mins: number,
    should_total: string,
    should_total_mins: number,
    diff: string,
    diff_mins: number,
    tags: string[],
    entries: KlogEntry[]
}

type JsonSuccess = {
    records: KlogRecord[],
    errors: null
}

type JsonError = {
    records: null,
    errors: KlogError[]
}

export type KlogJsonOutput = JsonSuccess | JsonError
