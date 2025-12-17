// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Intuition Manager
 *
 * Central manager for all Intuition AI features. Coordinates between
 * API client, content extraction, suggestions, and research tools.
 */

import { gIntuitionAPI } from "./api/IntuitionAPIClient.sys.mjs";
import { gContentExtractor } from "./content/ContentExtractor.sys.mjs";
import { gSmartSuggestions } from "./suggestions/SmartSuggestions.sys.mjs";
import { gResearchTools } from "./research/ResearchTools.sys.mjs";

export class IntuitionManager {
  constructor() {
    this.initialized = false;
    this.enabled = true;
  }

  /**
   * Initialize all Intuition AI features
   */
  async init() {
    if (this.initialized) {
      return;
    }

    console.log("[Intuition] Initializing AI features...");

    try {
      // Check if features are enabled
      this.enabled = Services.prefs.getBoolPref("intuition.ai.enabled", true);

      if (!this.enabled) {
        console.log("[Intuition] AI features disabled");
        return;
      }

      // Initialize all components
      await Promise.all([
        gIntuitionAPI.init(),
        gContentExtractor.init(),
        gSmartSuggestions.init(),
        gResearchTools.init(),
      ]);

      this.initialized = true;
      console.log("[Intuition] AI features initialized successfully");

      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error("[Intuition] Failed to initialize:", error);
    }
  }

  /**
   * Set up browser event listeners
   */
  setupEventListeners() {
    // Listen for page loads to extract content
    Services.obs.addObserver(this, "document-element-inserted");

    // Listen for workspace changes
    Services.obs.addObserver(this, "zen-workspace-changed");
  }

  /**
   * Observer interface for browser events
   */
  observe(subject, topic, data) {
    switch (topic) {
      case "document-element-inserted":
        this.onPageLoad(subject);
        break;
      case "zen-workspace-changed":
        this.onWorkspaceChanged(data);
        break;
    }
  }

  /**
   * Handle page load event
   */
  async onPageLoad(document) {
    if (!this.enabled || !document || !document.defaultView) {
      return;
    }

    try {
      const browser = document.defaultView.docShell.chromeEventHandler;
      if (!browser) {
        return;
      }

      // Extract content in background
      setTimeout(async () => {
        try {
          const extraction = await gContentExtractor.extractFromTab(browser);

          // Check for related clips
          const clips = gResearchTools.getClipsForUrl(extraction.url);
          if (clips.length > 0) {
            this.notifyClipsAvailable(browser, clips);
          }

          // Pre-generate suggestions for faster access
          await gSmartSuggestions.getSuggestions(browser);
        } catch (error) {
          console.error("[Intuition] Error processing page load:", error);
        }
      }, 1000); // Wait 1s for page to stabilize
    } catch (error) {
      console.error("[Intuition] Error in onPageLoad:", error);
    }
  }

  /**
   * Handle workspace change event
   */
  async onWorkspaceChanged(workspaceId) {
    console.log("[Intuition] Workspace changed:", workspaceId);

    // TODO: Implement workspace-specific AI features
    // - Load workspace context
    // - Suggest related tabs
    // - Auto-organize tabs by topic
  }

  /**
   * Notify user that clips are available for current page
   */
  notifyClipsAvailable(browser, clips) {
    // TODO: Show notification or badge in UI
    console.log(`[Intuition] ${clips.length} clips available for this page`);
  }

  /**
   * Get AI analysis for current page
   */
  async analyzePage(browser) {
    try {
      const extraction = await gContentExtractor.extractFromTab(browser);
      const summary = await gContentExtractor.summarize(extraction);
      const claims = await gContentExtractor.findRelatedClaims(extraction);
      const suggestions = await gSmartSuggestions.getSuggestions(browser);

      return {
        extraction,
        summary,
        claims,
        suggestions,
      };
    } catch (error) {
      console.error("[Intuition] Failed to analyze page:", error);
      return null;
    }
  }

  /**
   * Quick clip creation from context menu or keyboard shortcut
   */
  async quickClip(browser, selection = null) {
    try {
      const clip = await gResearchTools.createClip(browser, selection);

      // Show success notification
      this.showNotification("Clip created", clip.title);

      return clip;
    } catch (error) {
      console.error("[Intuition] Failed to create clip:", error);
      this.showNotification("Error", "Failed to create clip");
      return null;
    }
  }

  /**
   * Show notification to user
   */
  showNotification(title, message) {
    try {
      const alertsService = Cc["@mozilla.org/alerts-service;1"].getService(
        Ci.nsIAlertsService
      );

      alertsService.showAlertNotification(
        null, // icon
        title,
        message,
        false, // clickable
        "", // cookie
        null // alert listener
      );
    } catch (error) {
      console.error("[Intuition] Failed to show notification:", error);
    }
  }

  /**
   * Toggle AI features on/off
   */
  async toggleEnabled() {
    this.enabled = !this.enabled;
    Services.prefs.setBoolPref("intuition.ai.enabled", this.enabled);

    if (this.enabled && !this.initialized) {
      await this.init();
    }

    return this.enabled;
  }

  /**
   * Get status of AI features
   */
  getStatus() {
    return {
      enabled: this.enabled,
      initialized: this.initialized,
      apiConnected: gIntuitionAPI.initialized,
      userAuthenticated: !!gIntuitionAPI.userIdentity,
      clipsCount: gResearchTools.clips.size,
      annotationsCount: gResearchTools.annotations.size,
    };
  }

  /**
   * Clean up on shutdown
   */
  shutdown() {
    Services.obs.removeObserver(this, "document-element-inserted");
    Services.obs.removeObserver(this, "zen-workspace-changed");

    // Clear caches
    gSmartSuggestions.clearCache();

    this.initialized = false;
  }
}

// Export singleton instance
export const gIntuitionManager = new IntuitionManager();

// Auto-initialize on module load
if (typeof Services !== "undefined") {
  gIntuitionManager.init().catch(error => {
    console.error("[Intuition] Auto-init failed:", error);
  });
}
