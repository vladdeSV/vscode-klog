import { Static, Record, Union, Literal, String, Number, Boolean, Array, Null } from 'runtypes'

export type ValidateOnMode = Static<typeof ValidateOnMode>
export const ValidateOnMode = Union(
  Literal('save'),
  Literal('edit'),
)

export type KlogSettings = Static<typeof KlogSettings>
export const KlogSettings = Record({
  languageServer: Record({
    enable: Boolean,
    path: String,
    validateOn: ValidateOnMode,
  }),
})

export type Settings = Static<typeof Settings>
export const Settings = Record({
  klog: KlogSettings,
})

export type Error = Static<typeof Error>
export const Error = Record({
  line: Number,
  column: Number,
  length: Number,
  title: String,
  details: String,
})

type EntryCommon = Static<typeof EntryCommon>
const EntryCommon = Record({
  summary: String,
  tags: String,
  total: String,
  total_mins: Number,
})

type EntryRangeOpen = Static<typeof EntryRangeOpen>
const EntryRangeOpen = Record({
  type: Literal('open_range'),
  start: String,
  start_mins: Number,
})

type EntryRange = Static<typeof EntryRange>
const EntryRange = Record({
  type: Literal('range'),
  start: String,
  start_mins: Number,
  end: String,
  end_mins: Number,
})

type EntryDuration = Static<typeof EntryDuration>
const EntryDuration = Record({
  type: Literal('duration'),
})

type Entry = Static<typeof Entry>
const Entry = Union(
  EntryCommon,
  EntryRange,
  EntryRangeOpen,
  EntryDuration,
)

type KlogRecord = Static<typeof KlogRecord>
const KlogRecord = Record({
  date: String,
  summary: String,
  total: String,
  total_mins: Number,
  should_total: String,
  should_total_mins: Number,
  diff: String,
  diff_mins: Number,
  tags: Array(String),
  entries: Array(Entry),
})

const JsonSuccess = Record({
  records: Array(KlogRecord),
  errors: Null,
})

const JsonError = Record({
  records: Null,
  errors: Array(Error),
})

export type JsonOutput = Static<typeof JsonOutput>
export const JsonOutput = Union(
  JsonSuccess,
  JsonError,
)
