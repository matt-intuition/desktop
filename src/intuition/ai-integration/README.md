# Intuition AI Integration

This directory contains the AI-powered features that integrate the Intuition knowledge graph platform into the browser.

## Architecture

### Core Modules

- **IntuitionManager.sys.mjs**: Central coordinator for all AI features
- **api/IntuitionAPIClient.sys.mjs**: GraphQL client for Intuition platform API
- **content/ContentExtractor.sys.mjs**: Page content analysis and entity extraction
- **suggestions/SmartSuggestions.sys.mjs**: AI-powered browsing suggestions
- **research/ResearchTools.sys.mjs**: Web clipping and annotation system
- **ui/IntuitionPanel.mjs**: Sidebar panel UI component

## Features

### 1. Content Understanding
- Automatic page content extraction and analysis
- Entity recognition (URLs, emails, mentions, hashtags)
- Metadata extraction (Open Graph, article data)
- Content summarization

### 2. Smart Suggestions
- Context-aware browsing recommendations
- Knowledge graph-powered suggestions
- Behavioral pattern recognition
- Related content discovery

### 3. Research Tools
- Web clipping with selection support
- Annotation system for pages and clips
- Tag-based organization
- Export to Markdown, JSON, and plain text
- Knowledge base import/export

### 4. Knowledge Graph Integration
- Direct connection to Intuition platform
- Claim and attestation management
- Entity relationship discovery
- GraphQL query support

## Usage

The Intuition AI features are automatically initialized on browser startup. Users can access features via:

- **Sidebar Panel**: Toggle with keyboard shortcut or menu item
- **Context Menu**: Right-click to create clips or annotations
- **URL Bar**: Smart suggestions appear inline
- **Keyboard Shortcuts**: Quick clip creation and panel toggle

## Configuration

Preferences are stored under the `intuition.*` namespace:

- `intuition.ai.enabled`: Enable/disable all AI features (default: true)
- `intuition.user.identity`: User authentication token for Intuition API
- `intuition.research.data`: Saved clips and annotations

## Integration with Zen Features

The AI integration builds on existing Zen Browser features:

- **Workspaces**: AI-powered tab organization and context management
- **Vertical Tabs**: Smart suggestions in tab sidebar
- **Split View**: Content analysis across split panels
- **Glance**: Quick page insights in glance mode

## Development

### Adding New AI Features

1. Create module in appropriate subdirectory (api/, content/, etc.)
2. Export as `.sys.mjs` for Firefox module system compatibility
3. Import in `IntuitionManager.sys.mjs`
4. Add initialization in `IntuitionManager.init()`
5. Update `moz.build` to include new module

### Testing

AI features can be tested using the browser's test framework:

```bash
npm run test -- ai-integration
```

## API Reference

See individual module files for detailed API documentation.
