// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Research Tools
 *
 * Provides web clipping, annotation, and knowledge management features
 * integrated with the Intuition knowledge graph.
 */

import { gIntuitionAPI } from "../api/IntuitionAPIClient.sys.mjs";
import { gContentExtractor } from "../content/ContentExtractor.sys.mjs";

export class ResearchTools {
  constructor() {
    this.initialized = false;
    this.clips = new Map();
    this.annotations = new Map();
  }

  /**
   * Initialize research tools
   */
  async init() {
    if (this.initialized) {
      return;
    }

    // Load saved clips and annotations from storage
    await this.loadFromStorage();

    this.initialized = true;
    console.log("[Intuition] Research Tools initialized");
  }

  /**
   * Create a web clip from current page or selection
   */
  async createClip(browser, selection = null) {
    try {
      const extraction = await gContentExtractor.extractFromTab(browser);

      const clip = {
        id: this.generateId(),
        url: extraction.url,
        title: extraction.title,
        timestamp: Date.now(),
        content: selection || extraction.mainContent.text,
        isSelection: !!selection,
        metadata: {
          ...extraction.metadata,
          wordCount: selection
            ? selection.split(/\s+/).length
            : extraction.mainContent.wordCount,
        },
        tags: [],
        annotations: [],
      };

      // Save clip
      this.clips.set(clip.id, clip);
      await this.saveToStorage();

      // Create Intuition claim for this clip
      try {
        await gIntuitionAPI.createClaim(
          clip.url,
          "has_clip",
          clip.id
        );
      } catch (error) {
        console.error("[Intuition] Failed to create claim for clip:", error);
      }

      console.log("[Intuition] Created clip:", clip.id);
      return clip;
    } catch (error) {
      console.error("[Intuition] Failed to create clip:", error);
      throw error;
    }
  }

  /**
   * Add annotation to a page or clip
   */
  async createAnnotation(target, text, position = null) {
    try {
      const annotation = {
        id: this.generateId(),
        targetType: target.type, // 'clip' or 'url'
        targetId: target.id,
        text,
        position, // For highlighting specific text
        timestamp: Date.now(),
        tags: [],
      };

      // Save annotation
      this.annotations.set(annotation.id, annotation);

      // Associate with clip if applicable
      if (target.type === "clip" && this.clips.has(target.id)) {
        const clip = this.clips.get(target.id);
        clip.annotations.push(annotation.id);
      }

      await this.saveToStorage();

      console.log("[Intuition] Created annotation:", annotation.id);
      return annotation;
    } catch (error) {
      console.error("[Intuition] Failed to create annotation:", error);
      throw error;
    }
  }

  /**
   * Get all clips
   */
  getAllClips() {
    return Array.from(this.clips.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get clips for a specific URL
   */
  getClipsForUrl(url) {
    return this.getAllClips().filter(clip => clip.url === url);
  }

  /**
   * Get clip by ID
   */
  getClip(clipId) {
    return this.clips.get(clipId);
  }

  /**
   * Update clip
   */
  async updateClip(clipId, updates) {
    const clip = this.clips.get(clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }

    Object.assign(clip, updates);
    await this.saveToStorage();

    return clip;
  }

  /**
   * Delete clip
   */
  async deleteClip(clipId) {
    const clip = this.clips.get(clipId);
    if (!clip) {
      return false;
    }

    // Delete associated annotations
    for (const annotationId of clip.annotations) {
      this.annotations.delete(annotationId);
    }

    this.clips.delete(clipId);
    await this.saveToStorage();

    return true;
  }

  /**
   * Add tag to clip
   */
  async addTag(clipId, tag) {
    const clip = this.clips.get(clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }

    if (!clip.tags.includes(tag)) {
      clip.tags.push(tag);
      await this.saveToStorage();
    }

    return clip;
  }

  /**
   * Search clips by text or tags
   */
  searchClips(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllClips().filter(clip => {
      return (
        clip.title.toLowerCase().includes(lowerQuery) ||
        clip.content.toLowerCase().includes(lowerQuery) ||
        clip.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  /**
   * Export clip to various formats
   */
  async exportClip(clipId, format = "markdown") {
    const clip = this.clips.get(clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }

    switch (format) {
      case "markdown":
        return this.exportToMarkdown(clip);
      case "json":
        return JSON.stringify(clip, null, 2);
      case "text":
        return this.exportToText(clip);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Export clip to Markdown
   */
  exportToMarkdown(clip) {
    let md = `# ${clip.title}\n\n`;
    md += `**Source:** [${clip.url}](${clip.url})\n`;
    md += `**Date:** ${new Date(clip.timestamp).toLocaleDateString()}\n\n`;

    if (clip.tags.length > 0) {
      md += `**Tags:** ${clip.tags.join(", ")}\n\n`;
    }

    md += `## Content\n\n${clip.content}\n\n`;

    if (clip.annotations.length > 0) {
      md += `## Annotations\n\n`;
      for (const annotationId of clip.annotations) {
        const annotation = this.annotations.get(annotationId);
        if (annotation) {
          md += `- ${annotation.text}\n`;
        }
      }
    }

    return md;
  }

  /**
   * Export clip to plain text
   */
  exportToText(clip) {
    let text = `${clip.title}\n`;
    text += `${"=".repeat(clip.title.length)}\n\n`;
    text += `Source: ${clip.url}\n`;
    text += `Date: ${new Date(clip.timestamp).toLocaleDateString()}\n\n`;
    text += clip.content;

    return text;
  }

  /**
   * Export all clips to a knowledge base format
   */
  async exportKnowledgeBase() {
    const kb = {
      version: "1.0",
      exported: Date.now(),
      clips: this.getAllClips(),
      annotations: Array.from(this.annotations.values()),
      stats: {
        totalClips: this.clips.size,
        totalAnnotations: this.annotations.size,
        totalWords: this.getAllClips().reduce(
          (sum, clip) => sum + (clip.metadata.wordCount || 0),
          0
        ),
      },
    };

    return JSON.stringify(kb, null, 2);
  }

  /**
   * Import clips from knowledge base
   */
  async importKnowledgeBase(kbJson) {
    try {
      const kb = JSON.parse(kbJson);

      if (!kb.clips || !Array.isArray(kb.clips)) {
        throw new Error("Invalid knowledge base format");
      }

      // Import clips
      for (const clip of kb.clips) {
        this.clips.set(clip.id, clip);
      }

      // Import annotations
      if (kb.annotations && Array.isArray(kb.annotations)) {
        for (const annotation of kb.annotations) {
          this.annotations.set(annotation.id, annotation);
        }
      }

      await this.saveToStorage();

      console.log(`[Intuition] Imported ${kb.clips.length} clips`);
      return true;
    } catch (error) {
      console.error("[Intuition] Failed to import knowledge base:", error);
      throw error;
    }
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Save clips and annotations to storage
   */
  async saveToStorage() {
    try {
      const data = {
        clips: Array.from(this.clips.entries()),
        annotations: Array.from(this.annotations.entries()),
      };

      await Services.prefs.setStringPref(
        "intuition.research.data",
        JSON.stringify(data)
      );
    } catch (error) {
      console.error("[Intuition] Failed to save to storage:", error);
    }
  }

  /**
   * Load clips and annotations from storage
   */
  async loadFromStorage() {
    try {
      const dataStr = await Services.prefs.getStringPref(
        "intuition.research.data",
        null
      );

      if (!dataStr) {
        return;
      }

      const data = JSON.parse(dataStr);

      if (data.clips) {
        this.clips = new Map(data.clips);
      }

      if (data.annotations) {
        this.annotations = new Map(data.annotations);
      }

      console.log(
        `[Intuition] Loaded ${this.clips.size} clips and ${this.annotations.size} annotations`
      );
    } catch (error) {
      console.error("[Intuition] Failed to load from storage:", error);
    }
  }

  /**
   * Clear all research data
   */
  async clearAll() {
    this.clips.clear();
    this.annotations.clear();
    await this.saveToStorage();
  }
}

// Export singleton instance
export const gResearchTools = new ResearchTools();
