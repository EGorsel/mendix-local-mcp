# Mendix Context Bridge (Local MCP Server)

Dit project is een **Mendix Context Bridge**. Het stelt AI-agents (zoals Antigravity) in staat om direct de structuur en logica van jouw lokale Mendix-project te lezen en te begrijpen via het Model Context Protocol (MCP). Door rechtstreeks verbinding te maken met het lokale `.mpr` bestand, heeft de AI geen cloud-toegang nodig en werkt het razendsnel.

## Installatie

Volg deze stappen om de server lokaal te installeren:

1.  **Dependencies installeren**:
    ```bash
    npm install
    ```
2.  **Project bouwen**:
    ```bash
    npm run build
    ```

## Configuratie in Antigravity

Om Antigravity gebruik te laten maken van deze server, moet je het pad naar het gebouwde script toevoegen aan je `mcp_config.json`.

Zorg dat de configuratie er als volgt uitziet (pas het pad aan naar jouw locatie):

```json
{
  "mcpServers": {
    "mendix-local": {
      "command": "node",
      "args": [
        "C:/Volledig/Pad/Naar/Deze/Map/dist/server.js"
      ],
      "disabled": false
    }
  }
}
```

## Hoe te gebruiken

1.  **Open je Mendix projectmap** in Antigravity/VS Code.
2.  De AI assistent herkent automatisch het `.mpr` bestand in jouw map.
3.  Je kunt nu direct vragen stellen over je applicatie.

**Voorbeelden van vragen:**
*   *"Wat doet de microflow ACT_CalculateOrderTotal?"*
*   *"Welke attributen heeft de entiteit Customer?"*
*   *"Geef me een overzicht van alle modules in dit project."*

## Technische Details

De server maakt gebruik van de **better-sqlite3** bibliotheek om verbinding te maken met de Mendix database. Belangrijk om te weten:
*   De verbinding wordt gemaakt in **Read-Only** modus.
*   Dit betekent dat je de server veilig kunt gebruiken **terwijl Mendix Studio Pro geopend is**. Er ontstaan geen file-locks of conflicten.

## Beperkingen

*   **Opslaan vereist**: Omdat de server het fysieke `.mpr` bestand op je schijf leest, kan de AI wijzigingen die je net hebt gemaakt pas zien **nadat je het project hebt opgeslagen** in Mendix Studio Pro (Ctrl+S).
