import { SemVer } from 'semver';

export class Version {
  private readonly version: SemVer;
  private readonly increased: boolean;

  private constructor(version: SemVer, increased: boolean = false) {
    this.version = version;
    this.increased = increased;
  }

  public static parse(version?: string, initVersion: string = '0.0.0', prefix: string = 'v') {
    if (version === undefined) {
      return new Version(new SemVer(initVersion));
    }

    const versionWithoutPrefix = version.replace(prefix, '');

    return new Version(new SemVer(versionWithoutPrefix));
  }

  public increaseMajor(): Version {
    return this.increase('major');
  }

  public increaseMinor(): Version {
    return this.increase('minor');
  }

  public increasePatch(): Version {
    return this.increase('patch');
  }

  public isIncreased(): boolean {
    return this.increased;
  }

  public getMajor(): number {
    return this.version.major;
  }

  public getMinor(): number {
    return this.version.minor;
  }

  public getPatch(): number {
    return this.version.patch;
  }

  public toString(): string {
    return this.version.format();
  }

  public toTag(prefix: string = 'v'): string {
    const version = this.version.format();
    return `${prefix}${version}`;
  }

  private increase(type: 'major' | 'minor' | 'patch'): Version {
    const version = new SemVer(this.version.raw);
    version.inc(type);

    return new Version(version, true);
  }

}
