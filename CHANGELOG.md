# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2022-04-22
### Added
- Support for tags with values (eg. `#tag=value`)

## [1.2.0] - 2022-03-31
### Added
- Multiline entry summary syntax highlight
- Allow "nightly" versions of klog binary, where version is `v?.?`

### Changed
- Allow dashes in tags

## [1.1.0] - 2022-02-24
### Added
- Language server
- Snippets
    - Open-ended timespan, `tsoe`/`timespan-open-ended`
    - Current time, `time`
- `klog` version validation
- Changelog, retroactively

### Removed
- Removed errornous syntax hightlight, and instead depend on klog binary for errors

## [1.0.0] - 2021-04-06
### Added
- Syntax highlighting
- Snippets for common actions
    - Date, `date`
    - Record, `record`
    - Timespan, `ts`/`timespan`
    - Should-total, `st`/`should-total`
