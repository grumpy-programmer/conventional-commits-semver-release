import * as core from '@actions/core';
import * as github from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { components } from '@octokit/openapi-types/types.d';

export type Tag = components['schemas']['tag'];
export type Commit = components['schemas']['commit'];
export type Release = components['schemas']['release'];
export type ReleaseAsset = components['schemas']['release-asset'];

export class GithubService {
  private readonly client: InstanceType<typeof GitHub>;
  private readonly owner: string;
  private readonly repo: string;

  constructor(owner: string, repo: string, token: string) {
    this.owner = owner;
    this.repo = repo;

    core.debug(`github: creating client owner: ${this.owner}, repo: ${this.repo}, token: ${token.length > 0 ? 'present' : 'not present'}`);

    this.client = github.getOctokit(token);
  }

  public static create(): GithubService {
    const [owner, repo] = GithubService.getOwnerAndRepo();
    const token = GithubService.getToken();

    return new GithubService(owner, repo, token);
  }

  public async getLatestRelease(): Promise<Release | undefined> {
    core.debug('github: getting latest release');

    const release = await this.client.rest.repos.getLatestRelease({
      owner: this.owner,
      repo: this.repo
    })
      .then(response => response.data)
      .catch(() => undefined);

    core.debug(`github: found latest release tag: ${release?.tag_name}`);

    return release;
  }

  public async getAllReleases(limit: number = 10): Promise<Release[]> {
    core.debug(`github: getting all releases, limit: ${limit}`);

    const perPage = 100;

    const releases: Release[] = [];

    for (let page = 1; page < limit; page++) {
      const nextReleases = await this.getReleases(page, perPage);

      core.debug(`github: found: ${nextReleases.length} new releases on page: ${page}, already found: ${releases.length} releases`);

      releases.push(...nextReleases);

      if (nextReleases.length < perPage) {
        break;
      }
    }

    core.debug(`github: found: ${releases.length} releases`);

    return releases;
  }

  public async getReleases(page: number = 1, perPage: number = 30): Promise<Release[]> {
    core.debug(`github: getting releases page: ${page}, per page: ${perPage}`);

    const releases = await this.client.rest.repos.listReleases({
      owner: this.owner,
      repo: this.repo,
      page: page,
      per_page: perPage
    })
      .then(response => response.data);

    core.debug(`github: found: ${releases.length} releases, on page: ${page}, per page: ${perPage}`);

    return releases;
  }

  public async createRelease(tag: string, body: string): Promise<Release> {
    core.debug(`github: creating release with tag: ${tag}`);

    return this.client.rest.repos.createRelease({
      owner: this.owner,
      repo: this.repo,
      tag_name: tag,
      name: tag,
      body: body,
      draft: false,
      prerelease: false
    })
      .then(response => response.data);
  }

  public async uploadReleaseAsset(releaseId: number, name: string, data: any): Promise<ReleaseAsset> {
    return this.client.rest.repos.uploadReleaseAsset({
      owner: this.owner,
      repo: this.repo,
      release_id: releaseId,
      name: name,
      data: data
    })
      .then(response => response.data);
  }

  public async getTags(): Promise<Tag[]> {
    core.debug('github: getting tags');

    const tags = await this.client.rest.repos.listTags({
      owner: this.owner,
      repo: this.repo
    })
      .then(response => response.data);

    core.debug(`github: found: ${tags.length} tags`);

    return tags;
  }

  public async getCommit(sha: string): Promise<Commit> {
    core.debug(`github: getting commit sha: ${sha}`);

    const commit = await this.client.rest.repos.getCommit({
      owner: this.owner,
      repo: this.repo,
      ref: sha
    })
      .then(response => response.data);

    core.debug(`github: found commit sha: ${commit.sha}`);

    return commit;
  }

  public async getCommits(since?: string): Promise<Commit[]> {
    core.debug(`github: getting commits since: ${since}`);

    const commits = await this.client.rest.repos.listCommits({
      owner: this.owner,
      repo: this.repo,
      since: since
    })
      .then(response => response.data);

    core.debug(`github: found ${commits.length} commits`);

    return commits;
  }

  private static getOwnerAndRepo(): string[] {
    const repository = process.env.GITHUB_REPOSITORY;
    if (repository == undefined) {
      throw new Error('env var GITHUB_REPOSITORY not found');
    }

    if (repository.indexOf('/') < 0) {
      throw new Error('env var GITHUB_REPOSITORY contains invalid repository value');
    }

    return repository.split('/');
  }

  private static getToken(): string {
    const token = process.env.GITHUB_TOKEN;
    if (token == undefined) {
      throw new Error('env var GITHUB_TOKEN not found');
    }

    return token;
  }
}
