import type { CoverAccent, CoverVariant } from '../../shared/public/covers';

/** Markdown content is never trimmed or normalized during import or save. */
export interface EditablePost {
	title: string;
	slug: string;
	description: string;
	reading_excerpt: string | null;
	content: string;
	tags: string[];
	featured: boolean;
	cover_variant: CoverVariant | null;
	cover_accent: CoverAccent | null;
}

export interface EditorDocument {
	id: string;
	document: EditablePost;
	draftVersion: number;
	/** Current public row revision; zero means this is a new, private draft. */
	publishedRevision: number;
	/** Revision from which the working copy started. */
	baseRevision: number;
	publicationStatus: 'unpublished' | 'draft' | 'published';
	hasUnpublishedChanges: boolean;
	hasConflict: boolean;
	savedAt: string;
	publishedAt: string | null;
}

export type EditorSummary = Omit<EditorDocument, 'document'> & {
	title: string;
	slug: string;
	description: string;
	tags: string[];
};

export interface EditorErrorBody {
	error: string;
	code: string;
	fields?: Record<string, string>;
}

export function emptyDocument(): EditablePost {
	return {
		title: '', slug: '', description: '', reading_excerpt: null, content: '', tags: [],
		featured: false, cover_variant: null, cover_accent: null,
	};
}
