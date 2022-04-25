import * as core from '@actions/core';
import fs from 'fs';
import * as glob from 'glob';
import path from 'path';
import { GithubService, Release, ReleaseAsset } from './github';

const github = GithubService.create();

async function main() {
  const assetPatterns = core.getMultilineInput('assets');
  const tag = getState('tag');
  const version = getState('version');
  const released = getParsedState<boolean>('released');
  const messages = getParsedState<string[]>('messages');

  if (released) {
    core.info(`release: creating for version: ${version}, tag: ${tag}`);

    const release = await createRelease(tag, messages);

    core.info(`release: created id: ${release.id}`);

    if (assetPatterns.length > 0) {
      const assetFiles = findFiles(assetPatterns);

      core.info(`release asset: found ${assetFiles.length} to upload`);

      const releaseAsset = await uploadReleaseAssets(release, assetFiles);

      core.info(`release asset: uploaded ${releaseAsset.length} assets`);
    }
  } else {
    core.info('release: skip, no new version');
  }
}

function getParsedState<T>(key: string): T {
  const state = getState(key);

  return JSON.parse(state);
}

function getState(key: string): string {
  const state = core.getState(key);

  core.debug(`state: ${key} = ${state}`);

  return state;
}

async function createRelease(tag: string, messages: string[]) {
  const changelog = messages.map(m => `* ${m}\n`).join('');
  const body = `**Changelog:**\n${changelog}`;

  return github.createRelease(tag, body);
}

function findFiles(patterns: string[]): string[] {
  core.debug(`release asset: patterns: ${patterns}`);
  return patterns.flatMap(findFilesByPattern)
    .filter(checkIfIsFile);
}

function findFilesByPattern(pattern: string): string[] {
  const files = glob.sync(pattern);

  core.debug(`release asset: using pattern: ${pattern}, found files: ${files}`);

  return files;
}

function checkIfIsFile(file: string): boolean {
  const isFile = fs.statSync(file).isFile();
  if (!isFile) {
    core.debug(`release asset: found file: ${file} is not a file, skip`);
  }

  return isFile;
}

async function uploadReleaseAssets(release: Release, assetFiles: string[]): Promise<ReleaseAsset[]> {
  const assets: ReleaseAsset[] = [];

  for (const file of assetFiles) {
    const name = path.basename(file);
    const data = fs.readFileSync(file);

    core.debug(`release asset: uploading asset: ${name} from file: ${file}`);

    const asset = await github.uploadReleaseAsset(release.id, name, data);

    core.debug(`release asset: uploaded asset: ${asset.name}, id: ${asset.id}`);
    core.info(`release asset: uploaded asset ${asset.name}`);

    assets.push(asset);
  }

  return assets;
}

main()
  .catch(e => core.error(e));
