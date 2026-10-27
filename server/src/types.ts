import * as z from 'zod'

export type ValidateOnMode = z.infer<typeof ValidateOnMode>
export const ValidateOnMode = z.enum([
  'save',
  'edit',
])

export type KlogSettings = z.infer<typeof KlogSettings>
export const KlogSettings = z.object({
  languageServer: z.object({
    enable: z.boolean(),
    path: z.string(),
    validateOn: ValidateOnMode,
  }),
})

export type Settings = z.infer<typeof Settings>
export const Settings = z.object({
  klog: KlogSettings,
})

export type Error = z.infer<typeof Error>
export const Error = z.object({
  line: z.number(),
  column: z.number(),
  length: z.number(),
  title: z.string(),
  details: z.string(),
})

type EntryCommon = z.infer<typeof EntryCommon>
const EntryCommon = z.object({
  summary: z.string(),
  tags: z.array(z.string()),
  total: z.string(),
  total_mins: z.number(),
})

type EntryRangeOpen = z.infer<typeof EntryRangeOpen>
const EntryRangeOpen = EntryCommon.extend({
  type: z.literal('open_range'),
  start: z.string(),
  start_mins: z.number(),
})

type EntryRange = z.infer<typeof EntryRange>
const EntryRange = EntryCommon.extend({
  type: z.literal('range'),
  start: z.string(),
  start_mins: z.number(),
  end: z.string(),
  end_mins: z.number(),
})

type EntryDuration = z.infer<typeof EntryDuration>
const EntryDuration = EntryCommon.extend({
  type: z.literal('duration'),
})

type Entry = z.infer<typeof Entry>
const Entry = z.discriminatedUnion('type', [
  EntryRangeOpen,
  EntryRange,
  EntryDuration,
])

type KlogRecord = z.infer<typeof KlogRecord>
const KlogRecord = z.object({
  date: z.string(),
  summary: z.string(),
  total: z.string(),
  total_mins: z.number(),
  should_total: z.string(),
  should_total_mins: z.number(),
  diff: z.string(),
  diff_mins: z.number(),
  tags: z.array(z.string()),
  entries: z.array(Entry),
})

const JsonSuccess = z.object({
  records: z.array(KlogRecord),
  errors: z.null(),
})

const JsonError = z.object({
  records: z.null(),
  errors: z.array(Error),
})

export type JsonOutput = z.infer<typeof JsonOutput>
export const JsonOutput = z.union([
  JsonSuccess,
  JsonError,
])
