// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Intuition API Client
 *
 * Handles communication with the Intuition knowledge graph platform
 * via GraphQL API for attestations, claims, and identity management.
 */

const INTUITION_API_ENDPOINT = "https://api.intuition.systems/graphql";
const INTUITION_DOCS_BASE = "https://docs.intuition.systems";

export class IntuitionAPIClient {
  constructor() {
    this.endpoint = INTUITION_API_ENDPOINT;
    this.initialized = false;
    this.userIdentity = null;
  }

  /**
   * Initialize the Intuition API client
   */
  async init() {
    if (this.initialized) {
      return;
    }

    try {
      // Load user identity from storage if available
      await this.loadUserIdentity();
      this.initialized = true;
      console.log("[Intuition] API Client initialized");
    } catch (error) {
      console.error("[Intuition] Failed to initialize API client:", error);
    }
  }

  /**
   * Execute a GraphQL query
   */
  async query(queryString, variables = {}) {
    if (!this.initialized) {
      await this.init();
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.userIdentity?.token && {
            Authorization: `Bearer ${this.userIdentity.token}`,
          }),
        },
        body: JSON.stringify({
          query: queryString,
          variables,
        }),
      });

      const result = await response.json();

      if (result.errors) {
        console.error("[Intuition] GraphQL errors:", result.errors);
        throw new Error(result.errors[0]?.message || "GraphQL query failed");
      }

      return result.data;
    } catch (error) {
      console.error("[Intuition] Query failed:", error);
      throw error;
    }
  }

  /**
   * Search for claims related to a URL or content
   */
  async searchClaims(url, content) {
    const query = `
      query SearchClaims($url: String!, $content: String) {
        claims(where: {
          subject: { contains: $url }
        }) {
          id
          subject
          predicate
          object
          attestations {
            id
            creator
            confidence
            timestamp
          }
        }
      }
    `;

    return await this.query(query, { url, content });
  }

  /**
   * Create a new claim (attestation)
   */
  async createClaim(subject, predicate, object) {
    if (!this.userIdentity) {
      throw new Error("User must be authenticated to create claims");
    }

    const mutation = `
      mutation CreateClaim($subject: String!, $predicate: String!, $object: String!) {
        createClaim(
          subject: $subject
          predicate: $predicate
          object: $object
        ) {
          id
          subject
          predicate
          object
        }
      }
    `;

    return await this.query(mutation, { subject, predicate, object });
  }

  /**
   * Get entity information
   */
  async getEntity(entityId) {
    const query = `
      query GetEntity($id: ID!) {
        entity(id: $id) {
          id
          label
          description
          claims {
            id
            predicate
            object
          }
        }
      }
    `;

    return await this.query(query, { id: entityId });
  }

  /**
   * Load user identity from browser storage
   */
  async loadUserIdentity() {
    try {
      const identity = await Services.prefs.getStringPref(
        "intuition.user.identity",
        null
      );

      if (identity) {
        this.userIdentity = JSON.parse(identity);
      }
    } catch (error) {
      console.error("[Intuition] Failed to load user identity:", error);
    }
  }

  /**
   * Save user identity to browser storage
   */
  async saveUserIdentity(identity) {
    try {
      this.userIdentity = identity;
      await Services.prefs.setStringPref(
        "intuition.user.identity",
        JSON.stringify(identity)
      );
    } catch (error) {
      console.error("[Intuition] Failed to save user identity:", error);
    }
  }

  /**
   * Clear user identity
   */
  async clearUserIdentity() {
    this.userIdentity = null;
    try {
      await Services.prefs.clearUserPref("intuition.user.identity");
    } catch (error) {
      console.error("[Intuition] Failed to clear user identity:", error);
    }
  }
}

// Export singleton instance
export const gIntuitionAPI = new IntuitionAPIClient();
