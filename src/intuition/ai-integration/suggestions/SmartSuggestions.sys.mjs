// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Smart Suggestions System
 *
 * Provides AI-powered suggestions based on browsing context,
 * user behavior, and knowledge graph insights.
 */

import { gIntuitionAPI } from "../api/IntuitionAPIClient.sys.mjs";
import { gContentExtractor } from "../content/ContentExtractor.sys.mjs";

export class SmartSuggestions {
  constructor() {
    this.initialized = false;
    this.browsingHistory = [];
    this.contextCache = new Map();
  }

  /**
   * Initialize the smart suggestions system
   */
  async init() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    console.log("[Intuition] Smart Suggestions initialized");
  }

  /**
   * Get suggestions for the current browsing context
   */
  async getSuggestions(browser, query = "") {
    if (!this.initialized) {
      await this.init();
    }

    try {
      // Extract current page context
      const context = await this.getCurrentContext(browser);

      // Generate suggestions based on context
      const suggestions = [];

      // Add content-based suggestions
      const contentSuggestions = await this.getContentSuggestions(context);
      suggestions.push(...contentSuggestions);

      // Add knowledge graph suggestions
      const kgSuggestions = await this.getKnowledgeGraphSuggestions(context);
      suggestions.push(...kgSuggestions);

      // Add behavioral suggestions
      const behavioralSuggestions = await this.getBehavioralSuggestions(context);
      suggestions.push(...behavioralSuggestions);

      // Filter by query if provided
      let filtered = suggestions;
      if (query) {
        filtered = suggestions.filter(s =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.description.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Rank and return top suggestions
      return this.rankSuggestions(filtered).slice(0, 10);
    } catch (error) {
      console.error("[Intuition] Failed to get suggestions:", error);
      return [];
    }
  }

  /**
   * Get current browsing context
   */
  async getCurrentContext(browser) {
    const url = browser.currentURI.spec;

    // Check cache
    if (this.contextCache.has(url)) {
      return this.contextCache.get(url);
    }

    // Extract content
    const extraction = await gContentExtractor.extractFromTab(browser);

    // Build context
    const context = {
      url,
      extraction,
      timestamp: Date.now(),
      browsing History: this.browsingHistory.slice(-10), // Last 10 pages
    };

    // Cache context
    this.contextCache.set(url, context);

    // Update browsing history
    this.browsingHistory.push({
      url,
      title: extraction?.title || "",
      timestamp: Date.now(),
    });

    // Keep history limited to 100 items
    if (this.browsingHistory.length > 100) {
      this.browsingHistory.shift();
    }

    return context;
  }

  /**
   * Get content-based suggestions
   */
  async getContentSuggestions(context) {
    const suggestions = [];

    if (!context.extraction) {
      return suggestions;
    }

    const { mainContent, links, metadata } = context.extraction;

    // Suggest related articles from extracted links
    for (const link of links.slice(0, 5)) {
      if (link.text && link.text.length > 10) {
        suggestions.push({
          type: "related-article",
          title: link.text,
          description: "Related article from this page",
          url: link.url,
          score: 0.7,
          source: "content-extraction",
        });
      }
    }

    // Suggest based on keywords
    if (metadata.keywords && metadata.keywords.length > 0) {
      const topKeywords = metadata.keywords.slice(0, 3);
      suggestions.push({
        type: "keyword-search",
        title: `Explore: ${topKeywords.join(", ")}`,
        description: "Search for related topics",
        action: "search",
        query: topKeywords.join(" "),
        score: 0.6,
        source: "keyword-extraction",
      });
    }

    return suggestions;
  }

  /**
   * Get knowledge graph suggestions
   */
  async getKnowledgeGraphSuggestions(context) {
    const suggestions = [];

    try {
      // Search for related claims in Intuition
      const claims = await gContentExtractor.findRelatedClaims(context.extraction);

      if (claims && claims.claims) {
        for (const claim of claims.claims.slice(0, 5)) {
          suggestions.push({
            type: "knowledge-graph",
            title: `Claim: ${claim.predicate}`,
            description: `${claim.subject} → ${claim.object}`,
            claimId: claim.id,
            attestations: claim.attestations?.length || 0,
            score: 0.8,
            source: "intuition-api",
          });
        }
      }
    } catch (error) {
      console.error("[Intuition] Failed to get KG suggestions:", error);
    }

    return suggestions;
  }

  /**
   * Get behavioral suggestions based on user patterns
   */
  async getBehavioralSuggestions(context) {
    const suggestions = [];

    // Analyze recent browsing patterns
    const recentDomains = new Map();
    for (const item of this.browsingHistory.slice(-20)) {
      try {
        const domain = new URL(item.url).hostname;
        recentDomains.set(domain, (recentDomains.get(domain) || 0) + 1);
      } catch (e) {
        // Invalid URL, skip
      }
    }

    // Suggest frequently visited domains
    const sortedDomains = Array.from(recentDomains.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [domain, count] of sortedDomains) {
      if (count >= 3) {
        suggestions.push({
          type: "frequent-site",
          title: `Visit ${domain}`,
          description: `You've visited this site ${count} times recently`,
          url: `https://${domain}`,
          score: 0.5 + (count * 0.05),
          source: "behavior-analysis",
        });
      }
    }

    // Suggest "continue reading" if user was recently on a long article
    const recentLongArticles = this.browsingHistory
      .slice(-10)
      .filter(item => {
        const cached = this.contextCache.get(item.url);
        return cached?.extraction?.mainContent?.wordCount > 1000;
      });

    if (recentLongArticles.length > 0) {
      const article = recentLongArticles[recentLongArticles.length - 1];
      suggestions.push({
        type: "continue-reading",
        title: "Continue reading",
        description: article.title,
        url: article.url,
        score: 0.9,
        source: "behavior-analysis",
      });
    }

    return suggestions;
  }

  /**
   * Rank suggestions by score and relevance
   */
  rankSuggestions(suggestions) {
    return suggestions
      .sort((a, b) => {
        // Sort by score (descending)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Then by type priority
        const typePriority = {
          "continue-reading": 5,
          "knowledge-graph": 4,
          "related-article": 3,
          "frequent-site": 2,
          "keyword-search": 1,
        };
        return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
      });
  }

  /**
   * Record user interaction with suggestion
   */
  async recordInteraction(suggestion, action) {
    try {
      // Track which suggestions users interact with
      // This can be used to improve future suggestions
      console.log("[Intuition] Suggestion interaction:", {
        type: suggestion.type,
        action,
        timestamp: Date.now(),
      });

      // TODO: Send analytics to improve suggestion algorithm
    } catch (error) {
      console.error("[Intuition] Failed to record interaction:", error);
    }
  }

  /**
   * Clear context cache
   */
  clearCache() {
    this.contextCache.clear();
    this.browsingHistory = [];
  }
}

// Export singleton instance
export const gSmartSuggestions = new SmartSuggestions();
