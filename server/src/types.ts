import { Static, Object, Union, Literal, String, Number, Boolean, Array, Null } from 'runtypes'

export type ValidateOnMode = Static<typeof ValidateOnMode>
export const ValidateOnMode = Union(
  Literal('save'),
  Literal('edit'),
)

export type KlogSettings = Static<typeof KlogSettings>
export const KlogSettings = Object({
  languageServer: Object({
    enable: Boolean,
    path: String,
    validateOn: ValidateOnMode,
  }),
})

export type Settings = Static<typeof Settings>
export const Settings = Object({
  klog: KlogSettings,
})

export type Error = Static<typeof Error>
export const Error = Object({
  line: Number,
  column: Number,
  length: Number,
  title: String,
  details: String,
})

type EntryCommon = Static<typeof EntryCommon>
const EntryCommon = Object({
  summary: String,
  tags: String,
  total: String,
  total_mins: Number,
})

type EntryRangeOpen = Static<typeof EntryRangeOpen>
const EntryRangeOpen = Object({
  type: Literal('open_range'),
  start: String,
  start_mins: Number,
})

type EntryRange = Static<typeof EntryRange>
const EntryRange = Object({
  type: Literal('range'),
  start: String,
  start_mins: Number,
  end: String,
  end_mins: Number,
})

type EntryDuration = Static<typeof EntryDuration>
const EntryDuration = Object({
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
const KlogRecord = Object({
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

const JsonSuccess = Object({
  records: Array(KlogRecord),
  errors: Null,
})

const JsonError = Object({
  records: Null,
  errors: Array(Error),
})

export type JsonOutput = Static<typeof JsonOutput>
export const JsonOutput = Union(
  JsonSuccess,
  JsonError,
)
