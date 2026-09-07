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
    expect(source).toContain("12575 => array(");
    expect(source).toContain("'2d677b8' => array(");
    expect(source).toContain("'59b7de5' => array(");
    expect(source).toContain("'accc44a' => array(");
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
    expect(source.match(/document']->save\(array\('elements' => \$context\['tree'\]\)\)/g)).toHaveLength(5);
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

  test("implements exact registered media replacement without request-defined URLs or copy", () => {
    const mediaHandler = source.slice(source.indexOf("function genesis_ssi_elementor_leaf_v1_write_registered_media"), source.indexOf("function genesis_ssi_elementor_leaf_v1_write_many"));
    expect(source).toContain("REGISTERED_MEDIA_REFERENCE_REPLACEMENT");
    expect(source).toContain("'f3694b0' => array(");
    expect(source).toContain("'mediaReplacements' => array(");
    expect(source).toContain("count($replacements) !== 5");
    expect(source).toContain("wp_get_attachment_url($replacement['mediaId'])");
    expect(source).toContain("genesis_elementor_media_identity_mismatch");
    expect(source).toContain("genesis_elementor_media_region_mismatch");
    expect(source).toContain("genesis_elementor_media_protected_region");
    expect(source).toContain("'saveCount' => 1");
    expect(mediaHandler).not.toMatch(/\$params\[['\"](?:url|mediaId|alt|before|after|replacement)['\"]\]/);
  });

  test("implements registered semantic HTML without arbitrary structure or links", () => {
    const semanticHandler = source.slice(source.indexOf("function genesis_ssi_elementor_leaf_v1_write_semantic"), source.indexOf("function genesis_ssi_elementor_leaf_v1_write_registered_media"));
    expect(source).toContain("'mutationClasses' => array('SEMANTIC_HTML', 'INERT_CERTIFICATION')");
    expect(source).toContain("GENESIS-SEMANTIC-HTML-CERT-12575");
    expect(source).toContain("GENESIS-SEMANTIC-HTML-CERT-12575-59B7DE5");
    expect(source).toContain("GENESIS-SEMANTIC-HTML-CERT-12575-ACCC44A");
    for (const value of [
      "thermostat control for regulated enclosure temperature management",
      "Supports temperature management for projector installations within model-specific operating requirements.",
      "array('before' => 'ENC-AC-SM', 'after' => 'ENC-CC-SM')",
      "array('before' => 'ENC-AC-MD', 'after' => 'ENC-CC-MD')",
      "array('before' => 'ENC-AC-LG', 'after' => 'ENC-CC-LG')",
      "array('before' => 'ENC-AC-LG+', 'after' => 'ENC-CC-LG+')",
      "array('before' => 'ENC-AC-XL', 'after' => 'ENC-CC-XL')",
    ]) expect(source).toContain(value);
    expect(source).toContain("a7816bf54ece6edee0ed03e9f471f39a4aaf15195daef6141d028dc5684db70b");
    expect(source).toContain("genesis_ssi_elementor_leaf_v1_semantic_allowed");
    expect(source).toContain("if ($reason !== 'certification') $value = genesis_ssi_elementor_leaf_v1_semantic_unwrap");
    expect(source).toContain("if ($reason !== 'certification') {");
    expect(source).toContain("DOMDocument");
    expect(source).toContain("genesis_elementor_semantic_diff_forbidden");
    expect(source.match(/genesis_elementor_semantic_class_required/g)).toHaveLength(2);
    expect(semanticHandler).toContain("'saveCount' => 1");
    expect(semanticHandler).not.toMatch(/wp_cache_flush|rocket_clean_domain|w3tc_flush_all|litespeed_purge_all/);
    expect(semanticHandler).not.toMatch(/\$params\[['"](?:allowedTextTags|allowedAnchorUnwrapHrefs|allowedHrefReplacements|semanticPolicy)['"]\]/);
  });

  test("validates the exact three-leaf semantic transaction before one atomic save", () => {
    const atomicHandler = source.slice(source.indexOf("function genesis_ssi_elementor_leaf_v1_write_semantic_atomic"), source.indexOf("function genesis_ssi_elementor_leaf_v1_write_registered_media"));
    expect(source).toContain("'mutationClass' => 'SEMANTIC_HTML_ATOMIC'");
    expect(source).toContain("'orderedElementIds' => array('2d677b8', '59b7de5', 'accc44a')");
    expect(atomicHandler).toContain("count($params['changes']) !== count($expected_ids)");
    expect(atomicHandler).toContain("sanitize_key((string) $change['element_id']) !== $expected_ids[$index]");
    expect(atomicHandler).toContain("genesis_ssi_elementor_leaf_v1_semantic_allowed");
    expect(atomicHandler).toContain("genesis_elementor_leaf_stale_document");
    expect(atomicHandler).toContain("genesis_elementor_leaf_stale_leaf");
    expect(atomicHandler).toContain("genesis_elementor_leaf_oversized");
    expect(atomicHandler.match(/document']->save\(array\('elements' => \$context\['tree'\]\)\)/g)).toHaveLength(1);
    expect(atomicHandler.indexOf("genesis_ssi_elementor_leaf_v1_semantic_allowed")).toBeLessThan(atomicHandler.indexOf("$targets[$id]['settings']['html'] = $change['replacement']"));
    expect(atomicHandler.indexOf("$targets[$id]['settings']['html'] = $change['replacement']")).toBeLessThan(atomicHandler.indexOf("document']->save"));
    expect(atomicHandler).toContain("'changedElementIds' => $expected_ids");
    expect(atomicHandler).toContain("'leafSha256' => $after_leaf_hashes");
    expect(atomicHandler).not.toMatch(/wp_cache_flush|rocket_clean_domain|w3tc_flush_all|litespeed_purge_all/);
  });

  test("denies legacy single-leaf and generic multi-leaf bypasses for atomic-only semantic leaves", () => {
    const semanticHandler = source.slice(source.indexOf("function genesis_ssi_elementor_leaf_v1_write_semantic"), source.indexOf("function genesis_ssi_elementor_leaf_v1_write_semantic_atomic"));
    const genericHandler = source.slice(source.indexOf("function genesis_ssi_elementor_leaf_v1_write_many"), source.indexOf("add_action('rest_api_init'"));
    expect(source.match(/'atomicOnly' => true/g)).toHaveLength(2);
    expect(source.slice(source.indexOf("'2d677b8' => array("), source.indexOf("'59b7de5' => array("))).not.toContain("'atomicOnly' => true");
    expect(source.slice(source.indexOf("'59b7de5' => array("), source.indexOf("'accc44a' => array("))).toContain("'atomicOnly' => true");
    expect(source.slice(source.indexOf("'accc44a' => array("), source.indexOf("'atomicSemanticAuthority' => array("))).toContain("'atomicOnly' => true");
    expect(semanticHandler).toContain("genesis_elementor_semantic_atomic_required");
    expect(genericHandler).toContain("genesis_elementor_semantic_class_required");
  });
});