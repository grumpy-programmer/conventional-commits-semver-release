# Conventional commits semver release [![main](https://github.com/grumpy-programmer/conventional-commits-semver-release/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/grumpy-programmer/conventional-commits-semver-release/actions/workflows/main.yml)
GitHub Action for semantic versioning releases using conventional commits

GitHub action using [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)
to [semantic versioning](https://semver.org/spec/v2.0.0.html) repository.

**Features:**

- detects version increment by commit message keywords: `fix:` to increase path version, `feat:` to increase minor and `!`
  or `BREAKING CHANGE` to increment major,
- exposes `tag`, `version` and `released` output useful for docker image or package versioning,
- after detection version increase creates GitHub release and gives the option to upload files as release assets.

## Conventional commits

Conventional commits allow project versioning using keywords in the commit message.

The standard defines two specific keywords which presence in the commit message causes the version to increase: `fix` will increase path
and `feat:` minor version number. Increasing the major number is done by adding `!` to any keyword e.g. `refactor!:` or
adding `BREAKING CHANGE` to the commit message.

The standard does not limit keywords apart from `fix:` and `feat:`, the following are common: `build:`, `chore:`, `ci:`, `docs:`, `style:`
, `refactor:`, `perf:`, `test:`.

Apart from the simple form of the keyword e.g. `refactor:`, it is possible to add the component affected by the change
e.g. `refactor(payment):` where payment is the component name.

For more information visit [conventional commits documentation](https://www.conventionalcommits.org/en/v1.0.0/).

## Action by example

Let's assume we have a project written in golang, and we want to version it.

Before adding `conventional-commits-semver-release`, the action looks like this:

```yaml
name: main
on:
  push:
    branches:
      - main

jobs:
  build:
    runs-on: ubuntu-20.04
    steps:
      - name: checkout code
        uses: actions/checkout@v2

      - name: docker login
        uses: docker/login-action@v1
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: set up go 1.x
        uses: actions/setup-go@v2
        with:
          go-version: ^1.16

      - name: cache
        uses: actions/cache@v2
        with:
          path: ~/go/pkg/mod
          key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
          restore-keys: |
            ${{ runner.os }}-go-

      - name: build
        run: make build

      - name: docker build
        run: docker build -t my-repository/my-image

      - name: docker push
        run: |
          docker push my-repository/my-image
```

### Creating release

Simple usage of `conventional-commits-semver-release` only for create releases:

```yaml
      # ...
      - name: cache
        uses: actions/cache@v2
        with:
          path: ~/go/pkg/mod
          key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
          restore-keys: |
            ${{ runner.os }}-go-

      - name: semver
        uses: grumpy-programmer/conventional-commits-semver-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # token is mandatory to create the release

      - name: build
        run: make build

      - name: docker build
        run: docker build -t my-repository/my-image

      - name: docker push
        run: |
          docker push my-repository/my-image
```

### Push new image only on the new version

Making the step execution dependent on the new version release:

```yaml
      # ...
      - name: semver
        id: semver # required to use the output in other steps
        uses: grumpy-programmer/conventional-commits-semver-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: build
        run: make build

      - name: docker build
        run: docker build -t my-repository/my-image

      - name: docker push
        if: ${{ steps.semver.outputs.released == 'true' }}
        run: |
          docker push my-repository/my-image
```

### Using version

Version output from `conventional-commits-semver-release` could be used to add the version as a docker image tag:

```yaml
      # ...
      - name: semver
        id: semver
        uses: grumpy-programmer/conventional-commits-semver-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: build
        run: make build

      - name: docker build
        run: docker build -t my-repository/my-image

      - name: docker push
        if: ${{ steps.semver.outputs.released == 'true' }} # check if a new version will be released
        # docker tag command is required to add version as the image tag
        run: |
          docker tag my-repository/my-image my-repository/my-image:${{ steps.semver.outputs.version }} 
          docker push my-repository/my-image:${{ steps.semver.outputs.version }}
```

Output could be set to env:

```yaml
      # ...
      - name: docker push
        if: ${{ steps.semver.outputs.released == 'true' }}
        env:
          VERSION: ${{ steps.semver.outputs.version }} # setting version as env simplify usage
        run: |
          docker tag my-repository/my-image my-repository/my-image:${VERSION}
          docker push my-repository/my-image:${VERSION}
```

### Uploading assets

Adding dist files as release assets:

```yaml
      # ...
      - name: semver
        id: semver
        uses: grumpy-programmer/conventional-commits-semver-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          assets: dist/*

      - name: build
        run: make build

      - name: dist
        run: make dist

      - name: docker build
        run: docker build -t my-repository/my-image
      # ...
```

Multiple assets:

```yaml
      # ...
      - name: semver
        id: semver
        uses: grumpy-programmer/conventional-commits-semver-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          assets: |
            dist/*darwin_amd64.zip
            dist/*linux_arm64.zip
      # ...
```

All zip files assuming that dist has subdirectories:

```yaml
      # ...
      - name: semver
        id: semver
        uses: grumpy-programmer/conventional-commits-semver-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          assets: |
            dist/**/*.zip
      # ...
```

## Action details

The `version` and `tag` available in the output are set when declaring the action (`main`), release, and sending assets takes place after
successful completion of all steps and detection of a new version (`post`).

### Input

| input        | type             | default | description                                                             |
|--------------|------------------|---------|-------------------------------------------------------------------------|
| init-version | string           | 0.0.0   | initial version of the project                                          |
| tag-prefix   | string           | v       | tag prefix, useful for versioning multiple components in one repository |
| assets       | multiline string |         | list of files to be upload as assets                                    |

### Output

| output         | type   | example | description                                     |
|----------------|--------|---------|-------------------------------------------------|
| tag            | string | v1.2.3  | tag as tag-prefix + version                     |
| version        | string | 1.2.3   | new version or current version if not released  |
| version-major  | string | 1       | major part of version                           |
| version-minor  | string | 2       | minor part of version                           |
| version-patch  | string | 3       | patch part of version                           |
| tag-prefix     | string | v       | tag prefix the same as input                    |
| released       | bool   | true    | true if new version was released                |


## Releasing actions with Conventional commits semver release
This project is an example of how to implement releasing Github Actions. The main challenge is to commit built in the pipeline javascript code and updating major version tag.

You can check [main.yml](.github/workflows/main.yml) pipeline.
