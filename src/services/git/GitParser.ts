/**
 * Git Commit Parser for SixSpec Dimensional Commits
 * Parses commit messages with WHY and HOW dimensions
 * Based on SixSpec's commit-msg format
 */

export interface DimensionalCommit {
  commitHash?: string;
  commitType: 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore';
  subject: string;
  dimensions: {
    who?: string;
    what?: string;
    when?: string;
    where?: string;
    why: string;  // Required
    how: string;  // Required
  };
}

export interface ParseResult {
  valid: boolean;
  commit?: DimensionalCommit;
  errors: string[];
}

/**
 * Dimensional Git Commit Parser
 * Validates and parses commit messages following SixSpec format
 */
export class GitCommitParser {
  private static readonly SUBJECT_PATTERN = /^(feat|fix|refactor|docs|test|chore):\s*(.+)$/;
  private static readonly DIMENSION_PATTERN = /^(WHO|WHAT|WHEN|WHERE|HOW|WHY):\s*(.+)$/gm;

  /**
   * Validate commit message format
   * Returns validation errors (empty array if valid)
   */
  static validate(message: string): string[] {
    const errors: string[] = [];

    // Remove comment lines (lines starting with #)
    const lines = message.split('\n').filter(line => !line.trim().startsWith('#'));
    const cleanMsg = lines.join('\n').trim();

    // Skip if empty or merge commit
    if (!cleanMsg || cleanMsg.startsWith('Merge ')) {
      return [];
    }

    // Check for subject line with type
    const firstLine = cleanMsg.split('\n')[0];
    if (!this.SUBJECT_PATTERN.test(firstLine)) {
      errors.push('Subject must start with type: feat|fix|refactor|docs|test|chore');
    }

    // Check for required dimensions
    if (!/^WHY:\s*.+/m.test(cleanMsg)) {
      errors.push('Missing required dimension: WHY');
    }

    if (!/^HOW:\s*.+/m.test(cleanMsg)) {
      errors.push('Missing required dimension: HOW');
    }

    return errors;
  }

  /**
   * Parse commit message into dimensional commit object
   * Throws error if validation fails
   */
  static parse(message: string, commitHash?: string): DimensionalCommit {
    // Validate first
    const errors = this.validate(message);
    if (errors.length > 0) {
      throw new Error(`Invalid commit message:\n${errors.join('\n')}`);
    }

    // Remove comment lines
    const lines = message.split('\n').filter(line => !line.trim().startsWith('#'));
    const cleanMsg = lines.join('\n').trim();

    // Skip merge commits
    if (cleanMsg.startsWith('Merge ')) {
      throw new Error('Merge commits do not require dimensional metadata');
    }

    // Extract subject line and type
    const subjectLine = cleanMsg.split('\n')[0].trim();
    const subjectMatch = this.SUBJECT_PATTERN.exec(subjectLine);

    if (!subjectMatch) {
      throw new Error('Invalid subject line format');
    }

    const [, commitType, subject] = subjectMatch;

    // Extract all dimensions
    const dimensions: Partial<DimensionalCommit['dimensions']> = {};
    let match: RegExpExecArray | null;

    // Reset lastIndex for global regex
    this.DIMENSION_PATTERN.lastIndex = 0;

    while ((match = this.DIMENSION_PATTERN.exec(cleanMsg)) !== null) {
      const [, dimName, dimValue] = match;
      const key = dimName.toLowerCase() as keyof DimensionalCommit['dimensions'];
      dimensions[key] = dimValue.trim();
    }

    // Validate required dimensions
    if (!dimensions.why) {
      throw new Error('Missing required dimension: WHY');
    }
    if (!dimensions.how) {
      throw new Error('Missing required dimension: HOW');
    }

    return {
      commitHash,
      commitType: commitType as DimensionalCommit['commitType'],
      subject: subject.trim(),
      dimensions: dimensions as DimensionalCommit['dimensions']
    };
  }

  /**
   * Safe parse - returns ParseResult instead of throwing
   */
  static safeParse(message: string, commitHash?: string): ParseResult {
    try {
      const errors = this.validate(message);
      if (errors.length > 0) {
        return { valid: false, errors };
      }

      const commit = this.parse(message, commitHash);
      return { valid: true, commit, errors: [] };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Format a dimensional commit as a commit message string
   */
  static format(commit: DimensionalCommit): string {
    const lines: string[] = [];

    // Subject line
    lines.push(`${commit.commitType}: ${commit.subject}`);
    lines.push('');

    // Required dimensions
    lines.push(`WHY: ${commit.dimensions.why}`);
    lines.push(`HOW: ${commit.dimensions.how}`);

    // Optional dimensions
    if (commit.dimensions.what) lines.push(`WHAT: ${commit.dimensions.what}`);
    if (commit.dimensions.where) lines.push(`WHERE: ${commit.dimensions.where}`);
    if (commit.dimensions.who) lines.push(`WHO: ${commit.dimensions.who}`);
    if (commit.dimensions.when) lines.push(`WHEN: ${commit.dimensions.when}`);

    return lines.join('\n');
  }
}
