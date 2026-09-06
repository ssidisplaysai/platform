import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "wordpress-snippets/genesis-ssi-elementor-document-leaf-authority-v1.php"), "utf8");

describe("Genesis Elementor document-leaf authority", () => {
  test("uses Elementor document APIs and exact page/widget/leaf boundaries", () => {
    expect(source).toContain("documents->get($page_id)");
    expect(source).toContain("document']->save(array('elements' => $context['tree']))");
    expect(source).not.toContain("update_post_meta($page_id, '_elementor_data'");
    expect(source).toContain("GENESIS_SSI_ELEMENTOR_LEAF_V1_REGISTRY_VERSION = 'genesis-elementor-authority-v1'");
    expect(source).toContain("3810 => array(");
    expect(source).toContain("12596 => array(");
    expect(source).toContain("12608 => array(");
    for (const elementId of ["98e1f56", "0ce76cb", "e87d71c", "94e8256"]) expect(source).toContain(`'${elementId}' => array(`);
    expect(source).toContain("($params['leaf'] ?? '') !== 'settings.html'");
    expect(source).toContain("($element['widgetType'] ?? '') !== $authority['leaf']['widgetType']");
  });

  test("enforces authentication, CAS, size, uniqueness, and collateral readback", () => {
    expect(source).toContain("current_user_can('edit_others_pages')");
    expect(source).toContain("current_user_can('unfiltered_html')");
    expect(source).toContain("current_user_can('edit_post', $page_id)");
    expect(source).toContain("genesis_elementor_leaf_stale_document");
    expect(source).toContain("genesis_elementor_leaf_stale_leaf");
    expect(source).toContain("count($matches) !== 1");
    expect(source).toContain("$context['authority']['leaf']['maxBytes']");
    expect(source).toContain("genesis_elementor_leaf_collateral_change");
    expect(source).toContain("genesis_elementor_leaf_protected_region");
    expect(source).toContain("pageSettingsHash");
    expect(source).toContain("globalReferencesHash");
    expect(source).toContain("settingHashes");
    expect(source).not.toContain("ALL_ELEMENTOR_PAGES");
    expect(source).not.toMatch(/eval\s*\(|file_get_contents|unlink|glob\s*\(|update_option|activate_plugin|switch_theme/i);
  });

  test("validates all multi-leaf changes before one document save", () => {
    expect(source).toContain("genesis_ssi_elementor_leaf_v1_write_many($params)");
    expect(source).toContain("count(array_unique($requested_ids)) !== count($requested_ids)");
    expect(source).toContain("$requested_ids !== $expected_order");
    expect(source).toContain("foreach ($params['changes'] as $change)");
    expect(source.match(/document']->save\(array\('elements' => \$context\['tree'\]\)\)/g)).toHaveLength(2);
    expect(source).toContain("'saveCount' => 1");
    expect(source).toContain("'changedElementIds' => $requested_ids");
  });

  test("keeps certification-only pages incapable of semantic remediation", () => {
    expect(source).toContain("'bc00420' => array('widgetType' => 'html', 'leaf' => 'settings.html', 'maxBytes' => 100000, 'reasons' => array('certification', 'rollback'))");
    expect(source).toContain("'be422a0' => array('widgetType' => 'html', 'leaf' => 'settings.html', 'maxBytes' => 100000, 'reasons' => array('certification', 'rollback'))");
    expect(source).toContain("!in_array($reason, $leaf['reasons'], true)");
  });

  test("contains every fail-closed security boundary required for registered mutation", () => {
    for (const boundary of [
      "genesis_elementor_leaf_unauthorized",
      "genesis_elementor_leaf_wrong_site",
      "genesis_elementor_leaf_forbidden",
      "genesis_elementor_leaf_html_forbidden",
      "genesis_elementor_leaf_page_forbidden",
      "genesis_elementor_leaf_target_forbidden",
      "genesis_elementor_leaf_stale_document",
      "genesis_elementor_leaf_stale_leaf",
      "genesis_elementor_leaf_oversized",
      "genesis_elementor_leaf_protected_region",
      "genesis_elementor_leaf_readback_failed",
      "genesis_elementor_leaf_collateral_change",
    ]) expect(source).toContain(boundary);
    expect(source).toContain("Scripts, styles, and media are immutable");
    expect(source).toContain("$readback['pageSettingsHash'] !== $context['pageSettingsHash']");
    expect(source).toContain("$readback['globalReferencesHash'] !== $context['globalReferencesHash']");
    expect(source).not.toMatch(/\$params\[['\"](?:registry|authority|allowed_ids|widgetType|maxBytes)['\"]\]/);
  });
});