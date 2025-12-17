// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Content Extractor
 *
 * Extracts and analyzes content from web pages for AI processing.
 * Provides semantic understanding, entity extraction, and summarization.
 */

import { gIntuitionAPI } from "../api/IntuitionAPIClient.sys.mjs";

export class ContentExtractor {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the content extractor
   */
  async init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    console.log("[Intuition] Content Extractor initialized");
  }

  /**
   * Extract structured content from a browser tab
   */
  async extractFromTab(browser) {
    try {
      const doc = browser.contentDocument;
      if (!doc) {
        return null;
      }

      const extraction = {
        url: browser.currentURI.spec,
        title: doc.title,
        timestamp: Date.now(),
        metadata: await this.extractMetadata(doc),
        mainContent: await this.extractMainContent(doc),
        entities: await this.extractEntities(doc),
        links: await this.extractLinks(doc),
        media: await this.extractMedia(doc),
      };

      return extraction;
    } catch (error) {
      console.error("[Intuition] Content extraction failed:", error);
      return null;
    }
  }

  /**
   * Extract metadata from document
   */
  async extractMetadata(doc) {
    const metadata = {
      description: "",
      keywords: [],
      author: "",
      published: null,
      modified: null,
      canonicalUrl: "",
      ogTags: {},
    };

    // Get meta tags
    const metaTags = doc.querySelectorAll("meta");
    for (const meta of metaTags) {
      const name = meta.getAttribute("name") || meta.getAttribute("property");
      const content = meta.getAttribute("content");

      if (!name || !content) continue;

      // Standard meta tags
      if (name === "description") metadata.description = content;
      if (name === "keywords") metadata.keywords = content.split(",").map(k => k.trim());
      if (name === "author") metadata.author = content;

      // Open Graph tags
      if (name.startsWith("og:")) {
        metadata.ogTags[name.substring(3)] = content;
      }

      // Article metadata
      if (name === "article:published_time") metadata.published = content;
      if (name === "article:modified_time") metadata.modified = content;
    }

    // Get canonical URL
    const canonical = doc.querySelector('link[rel="canonical"]');
    if (canonical) {
      metadata.canonicalUrl = canonical.getAttribute("href");
    }

    return metadata;
  }

  /**
   * Extract main content from page
   */
  async extractMainContent(doc) {
    // Try to find main content area
    const mainSelectors = [
      "main",
      "article",
      '[role="main"]',
      ".main-content",
      "#main-content",
      ".article-content",
      ".post-content",
    ];

    let mainElement = null;
    for (const selector of mainSelectors) {
      mainElement = doc.querySelector(selector);
      if (mainElement) break;
    }

    // Fallback to body if no main content found
    if (!mainElement) {
      mainElement = doc.body;
    }

    if (!mainElement) {
      return { text: "", html: "", wordCount: 0 };
    }

    // Extract text content
    const text = this.extractCleanText(mainElement);
    const html = mainElement.innerHTML;
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return {
      text,
      html,
      wordCount,
      headings: this.extractHeadings(mainElement),
    };
  }

  /**
   * Extract clean text from element
   */
  extractCleanText(element) {
    const clone = element.cloneNode(true);

    // Remove script, style, and other non-content elements
    const removeSelectors = ["script", "style", "nav", "header", "footer", "aside"];
    removeSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    return clone.textContent.trim().replace(/\s+/g, " ");
  }

  /**
   * Extract headings structure
   */
  extractHeadings(element) {
    const headings = [];
    const headingElements = element.querySelectorAll("h1, h2, h3, h4, h5, h6");

    headingElements.forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.substring(1)),
        text: heading.textContent.trim(),
      });
    });

    return headings;
  }

  /**
   * Extract entities (simple version - can be enhanced with NLP)
   */
  async extractEntities(doc) {
    const entities = {
      urls: new Set(),
      emails: new Set(),
      mentions: new Set(),
      hashtags: new Set(),
    };

    const text = doc.body.textContent;

    // Extract URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => entities.urls.add(url));

    // Extract emails
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex) || [];
    emails.forEach(email => entities.emails.add(email));

    // Extract @mentions
    const mentionRegex = /@[\w]+/g;
    const mentions = text.match(mentionRegex) || [];
    mentions.forEach(mention => entities.mentions.add(mention));

    // Extract #hashtags
    const hashtagRegex = /#[\w]+/g;
    const hashtags = text.match(hashtagRegex) || [];
    hashtags.forEach(hashtag => entities.hashtags.add(hashtag));

    return {
      urls: Array.from(entities.urls),
      emails: Array.from(entities.emails),
      mentions: Array.from(entities.mentions),
      hashtags: Array.from(entities.hashtags),
    };
  }

  /**
   * Extract links from page
   */
  async extractLinks(doc) {
    const links = [];
    const linkElements = doc.querySelectorAll("a[href]");

    linkElements.forEach(link => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("javascript:")) {
        links.push({
          url: href,
          text: link.textContent.trim(),
          title: link.getAttribute("title") || "",
        });
      }
    });

    return links.slice(0, 100); // Limit to 100 links
  }

  /**
   * Extract media from page
   */
  async extractMedia(doc) {
    const media = {
      images: [],
      videos: [],
    };

    // Extract images
    const images = doc.querySelectorAll("img[src]");
    images.forEach(img => {
      media.images.push({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt") || "",
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    });

    // Extract videos
    const videos = doc.querySelectorAll("video[src], video source");
    videos.forEach(video => {
      const src = video.getAttribute("src");
      if (src) {
        media.videos.push({
          src,
          type: video.getAttribute("type") || "",
        });
      }
    });

    return {
      images: media.images.slice(0, 20), // Limit to 20 images
      videos: media.videos.slice(0, 10), // Limit to 10 videos
    };
  }

  /**
   * Generate a summary of the page content
   */
  async summarize(extraction) {
    if (!extraction || !extraction.mainContent) {
      return "";
    }

    const text = extraction.mainContent.text;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Simple extractive summary - take first 3 sentences
    // TODO: Enhance with AI-powered summarization
    const summary = sentences.slice(0, 3).join(". ") + ".";

    return summary;
  }

  /**
   * Search for related Intuition claims
   */
  async findRelatedClaims(extraction) {
    try {
      const claims = await gIntuitionAPI.searchClaims(
        extraction.url,
        extraction.mainContent.text.substring(0, 500)
      );

      return claims;
    } catch (error) {
      console.error("[Intuition] Failed to find related claims:", error);
      return null;
    }
  }
}

// Export singleton instance
export const gContentExtractor = new ContentExtractor();
