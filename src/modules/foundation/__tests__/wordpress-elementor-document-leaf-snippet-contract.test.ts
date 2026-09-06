import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "wordpress-snippets/genesis-ssi-elementor-document-leaf-authority-v1.php"), "utf8");

describe("Genesis Elementor document-leaf authority", () => {
  test("uses Elementor document APIs and exact page/widget/leaf boundaries", () => {
    expect(source).toContain("documents->get($page_id)");
    expect(source).toContain("document']->save(array('elements' => $context['tree']))");
    expect(source).not.toContain("update_post_meta($page_id, '_elementor_data'");
    expect(source).toContain("GENESIS_SSI_ELEMENTOR_LEAF_V1_PAGE_ID = 3810");
    expect(source).toContain("'98e1f56', '0ce76cb', 'e87d71c', '94e8256'");
    expect(source).toContain("($params['leaf'] ?? '') !== 'settings.html'");
    expect(source).toContain("($element['widgetType'] ?? '') !== 'html'");
  });

  test("enforces authentication, CAS, size, uniqueness, and collateral readback", () => {
    expect(source).toContain("current_user_can('edit_others_pages')");
    expect(source).toContain("current_user_can('unfiltered_html')");
    expect(source).toContain("current_user_can('edit_post', $page_id)");
    expect(source).toContain("genesis_elementor_leaf_stale_document");
    expect(source).toContain("genesis_elementor_leaf_stale_leaf");
    expect(source).toContain("count($matches) !== 1");
    expect(source).toContain("GENESIS_SSI_ELEMENTOR_LEAF_V1_MAX_BYTES");
    expect(source).toContain("genesis_elementor_leaf_collateral_change");
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
});