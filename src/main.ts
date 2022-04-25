import * as core from '@actions/core';
import { Commit, GithubService, Release } from './github';
import { Version } from './version';

const EXCLAMATION_MARK_BRAKING_CHANGE_REGEX = new RegExp(/^.+!: /);
const BRAKING_CHANGE_REGEX = new RegExp(/.*BREAKING CHANGE.*/);
const FIX_REGEX = new RegExp(/^fix(|\(.+\)): /);
const FEATURE_REGEX = new RegExp(/^feat(|\(.+\)): /);

const github = GithubService.create();

async function main() {
  const initVersion = core.getInput('init-version') || '0.0.0';
  const tagPrefix = core.getInput('tag-prefix') || 'v';

  core.debug(`main: input initVersion: ${initVersion}`);
  core.debug(`main: input tagPrefix: ${tagPrefix}`);

  const releases = await github.getAllReleases();

  core.debug(`main: found ${releases.length} releases`);

  const release = getLatestRelease(releases, tagPrefix);

  core.debug(`main: found latest release tag: ${release?.tag_name}, created at: ${release?.created_at}`);

  const commit = await getReleaseCommit(release);

  core.debug(`main: found commit sha: ${commit?.sha}`);

  const date = commit?.commit?.author?.date;

  core.debug(`main: commit date: ${date}`);

  const commits = await github.getCommits(date);

  core.debug(`main: found ${commits.length} commits since ${date}`);

  const messages = extractMessages(commits);

  core.debug(`main: found ${messages.length} commit messages`);

  if (commit !== undefined) {
    messages.pop();
  }

  const oldVersion = Version.parse(release?.tag_name, initVersion, tagPrefix);
  const oldTag = oldVersion.toTag(tagPrefix);

  core.info(`last version: ${oldVersion}, tag: ${oldTag}`);

  const newVersion = increaseVersionByMessages(oldVersion, messages);

  const tag = newVersion.toTag(tagPrefix);
  const version = newVersion.toString();
  const versionMajor = newVersion.getMajor();
  const versionMinor = newVersion.getMinor();
  const versionPatch = newVersion.getPatch();
  const released = newVersion.isIncreased();

  core.debug(`main: computed tag: ${tag}, version: ${version}, released: ${released}`);

  if (released) {
    core.info(`new version: ${version}, tag: ${tag}`);
  } else {
    core.info('no new version');
  }

  core.setOutput('tag', tag);
  core.setOutput('version', version);
  core.setOutput('version-major', versionMajor);
  core.setOutput('version-minor', versionMinor);
  core.setOutput('version-patch', versionPatch);
  core.setOutput('tag-prefix', tagPrefix);
  core.setOutput('released', released);

  core.debug(`main: output tag: ${tag}, version: ${version}, version-major: ${versionMajor}, version-minor: ${versionMinor}, version-path: ${versionPatch}, tag-prefix: ${tagPrefix}, released: ${released}`);

  core.saveState('tag', tag);
  core.saveState('version', version);
  core.saveState('released', released);
  core.saveState('messages', messages);

  core.debug(`main: state set tag: ${tag}, version: ${version}, released: ${released}, message count: ${messages.length}`);
}

function getLatestRelease(releases: Release[], prefix: string): Release | undefined {
  return releases.filter(release => release.tag_name.startsWith(prefix))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .pop();
}

async function getReleaseCommit(release?: Release): Promise<Commit | undefined> {
  if (release === undefined) {
    return;
  }

  const tags = await github.getTags();

  const tag = tags.find(t => t.name === release.tag_name);

  if (tag === undefined) {
    return;
  }

  return github.getCommit(tag.commit.sha);
}

function extractMessages(commits: Commit[]): string[] {
  return commits
    .map(commit => commit.commit.message)
    .map(m => m.replace(/\r/g, ''))
    .map(m => m.replace(/\n\n/g, '\n'));
}

function increaseVersionByMessages(version: Version, messages: string[]): Version {
  if (messages.findIndex(breakingChangeTest) >= 0) {
    return version.increaseMajor();
  }

  if (messages.findIndex(featureTest) >= 0) {
    return version.increaseMinor();
  }

  if (messages.findIndex(fixTest) >= 0) {
    return version.increasePatch();
  }

  return version;
}

function breakingChangeTest(message: string): boolean {
  return EXCLAMATION_MARK_BRAKING_CHANGE_REGEX.test(message) || BRAKING_CHANGE_REGEX.test(message);
}

function featureTest(message: string): boolean {
  return FEATURE_REGEX.test(message);
}

function fixTest(message: string): boolean {
  return FIX_REGEX.test(message);
}

main()
  .catch(e => core.error(e));
