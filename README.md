# Snapshot Generator

This app monitors the [push](https://developer.github.com/v3/activity/events/types/#pushevent) event and generate snapshots for a spec.

## Install

Once the Webhook is created,
you **must** add a configuration file to the root of your repository.
Nothing will happen until you do.

## Configuration file

You can configure Snapshot Generator by adding a `.pr-preview.json` file at the root of your repository with the following fields:

```json
{
    "src_file": "index.bs",
    "type": "bikeshed"
}
```

### `src_file` (required)

This should point to the relative path to the source file from the root of the repository.

### `type` (required)

One of "bikeshed" or "respec".

## Acknowledgments

* [PR Preview](https://github.com/tobie/pr-preview)