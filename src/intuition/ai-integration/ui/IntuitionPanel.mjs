// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Intuition Panel UI
 *
 * Sidebar panel that displays AI features, suggestions, and research tools.
 */

import { gIntuitionManager } from "../IntuitionManager.sys.mjs";
import { gSmartSuggestions } from "../suggestions/SmartSuggestions.sys.mjs";
import { gResearchTools } from "../research/ResearchTools.sys.mjs";

export const IntuitionPanel = {
  _initialized: false,
  _panel: null,

  init() {
    if (this._initialized) {
      return;
    }

    this._initialized = true;
    console.log("[Intuition] Panel UI initialized");
  },

  /**
   * Create and show the Intuition sidebar panel
   */
  async show(window) {
    const doc = window.document;

    // Check if panel already exists
    let panel = doc.getElementById("intuition-panel");
    if (!panel) {
      panel = this.createPanel(doc);
    }

    // Update panel content
    await this.updatePanel(window, panel);

    // Show the panel
    panel.hidden = false;

    return panel;
  },

  /**
   * Create the panel DOM structure
   */
  createPanel(doc) {
    const panel = doc.createXULElement("vbox");
    panel.id = "intuition-panel";
    panel.className = "intuition-panel";

    // Header
    const header = doc.createXULElement("hbox");
    header.className = "intuition-panel-header";

    const title = doc.createXULElement("label");
    title.value = "Intuition AI";
    title.className = "intuition-panel-title";
    header.appendChild(title);

    const closeBtn = doc.createXULElement("toolbarbutton");
    closeBtn.className = "intuition-panel-close";
    closeBtn.addEventListener("command", () => {
      panel.hidden = true;
    });
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Content area
    const content = doc.createXULElement("vbox");
    content.id = "intuition-panel-content";
    content.className = "intuition-panel-content";
    content.setAttribute("flex", "1");
    panel.appendChild(content);

    // Add to browser
    const browserContainer = doc.getElementById("browser");
    if (browserContainer) {
      browserContainer.appendChild(panel);
    }

    return panel;
  },

  /**
   * Update panel content with current data
   */
  async updatePanel(window, panel) {
    const content = panel.querySelector("#intuition-panel-content");
    if (!content) {
      return;
    }

    // Clear existing content
    while (content.firstChild) {
      content.firstChild.remove();
    }

    const doc = window.document;
    const browser = window.gBrowser.selectedBrowser;

    // Show loading state
    const loading = doc.createXULElement("label");
    loading.value = "Loading insights...";
    loading.className = "intuition-loading";
    content.appendChild(loading);

    try {
      // Get AI analysis
      const analysis = await gIntuitionManager.analyzePage(browser);

      // Clear loading
      loading.remove();

      if (!analysis) {
        const error = doc.createXULElement("label");
        error.value = "Unable to analyze page";
        error.className = "intuition-error";
        content.appendChild(error);
        return;
      }

      // Add summary section
      if (analysis.summary) {
        this.addSection(doc, content, "Summary", analysis.summary);
      }

      // Add suggestions section
      if (analysis.suggestions && analysis.suggestions.length > 0) {
        this.addSuggestionsSection(doc, content, analysis.suggestions, window);
      }

      // Add clips section
      const clips = gResearchTools.getClipsForUrl(analysis.extraction.url);
      if (clips.length > 0) {
        this.addClipsSection(doc, content, clips, window);
      }

      // Add quick actions
      this.addQuickActions(doc, content, window);
    } catch (error) {
      console.error("[Intuition] Failed to update panel:", error);
      loading.value = "Error loading insights";
      loading.className = "intuition-error";
    }
  },

  /**
   * Add a text section to the panel
   */
  addSection(doc, container, title, text) {
    const section = doc.createXULElement("vbox");
    section.className = "intuition-section";

    const sectionTitle = doc.createXULElement("label");
    sectionTitle.value = title;
    sectionTitle.className = "intuition-section-title";
    section.appendChild(sectionTitle);

    const sectionText = doc.createXULElement("description");
    sectionText.textContent = text;
    sectionText.className = "intuition-section-text";
    section.appendChild(sectionText);

    container.appendChild(section);
  },

  /**
   * Add suggestions section
   */
  addSuggestionsSection(doc, container, suggestions, window) {
    const section = doc.createXULElement("vbox");
    section.className = "intuition-section";

    const title = doc.createXULElement("label");
    title.value = "Smart Suggestions";
    title.className = "intuition-section-title";
    section.appendChild(title);

    const list = doc.createXULElement("vbox");
    list.className = "intuition-suggestions-list";

    for (const suggestion of suggestions.slice(0, 5)) {
      const item = doc.createXULElement("hbox");
      item.className = "intuition-suggestion-item";

      const label = doc.createXULElement("label");
      label.value = suggestion.title;
      label.className = "intuition-suggestion-title";
      label.setAttribute("flex", "1");
      item.appendChild(label);

      const button = doc.createXULElement("button");
      button.label = "Open";
      button.className = "intuition-suggestion-action";
      button.addEventListener("command", () => {
        if (suggestion.url) {
          window.openTrustedLinkIn(suggestion.url, "tab");
        }
        gSmartSuggestions.recordInteraction(suggestion, "open");
      });
      item.appendChild(button);

      list.appendChild(item);
    }

    section.appendChild(list);
    container.appendChild(section);
  },

  /**
   * Add clips section
   */
  addClipsSection(doc, container, clips, window) {
    const section = doc.createXULElement("vbox");
    section.className = "intuition-section";

    const title = doc.createXULElement("label");
    title.value = `Saved Clips (${clips.length})`;
    title.className = "intuition-section-title";
    section.appendChild(title);

    const list = doc.createXULElement("vbox");
    list.className = "intuition-clips-list";

    for (const clip of clips.slice(0, 3)) {
      const item = doc.createXULElement("vbox");
      item.className = "intuition-clip-item";

      const clipTitle = doc.createXULElement("label");
      clipTitle.value = clip.title;
      clipTitle.className = "intuition-clip-title";
      item.appendChild(clipTitle);

      const clipDate = doc.createXULElement("label");
      clipDate.value = new Date(clip.timestamp).toLocaleDateString();
      clipDate.className = "intuition-clip-date";
      item.appendChild(clipDate);

      list.appendChild(item);
    }

    section.appendChild(list);
    container.appendChild(section);
  },

  /**
   * Add quick action buttons
   */
  addQuickActions(doc, container, window) {
    const section = doc.createXULElement("vbox");
    section.className = "intuition-section";

    const title = doc.createXULElement("label");
    title.value = "Quick Actions";
    title.className = "intuition-section-title";
    section.appendChild(title);

    const actions = doc.createXULElement("hbox");
    actions.className = "intuition-actions";

    // Clip page button
    const clipBtn = doc.createXULElement("button");
    clipBtn.label = "Clip Page";
    clipBtn.className = "intuition-action-button";
    clipBtn.addEventListener("command", async () => {
      await gIntuitionManager.quickClip(window.gBrowser.selectedBrowser);
      this.updatePanel(window, container.parentElement);
    });
    actions.appendChild(clipBtn);

    // Refresh button
    const refreshBtn = doc.createXULElement("button");
    refreshBtn.label = "Refresh";
    refreshBtn.className = "intuition-action-button";
    refreshBtn.addEventListener("command", () => {
      this.updatePanel(window, container.parentElement);
    });
    actions.appendChild(refreshBtn);

    section.appendChild(actions);
    container.appendChild(section);
  },

  /**
   * Hide the panel
   */
  hide(window) {
    const panel = window.document.getElementById("intuition-panel");
    if (panel) {
      panel.hidden = true;
    }
  },

  /**
   * Toggle panel visibility
   */
  toggle(window) {
    const panel = window.document.getElementById("intuition-panel");
    if (panel && !panel.hidden) {
      this.hide(window);
    } else {
      this.show(window);
    }
  },
};
