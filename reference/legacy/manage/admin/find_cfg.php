<?php
/**
 * @author 张昌彪
 * @模块 
 * @功能 查询整张cfg表
 * @参数
 *       type     things/armor/goods，选择要浏览的配置表
 *       keyword  名称模糊搜索（可选）
 *       page     页码（可选，默认 1）
 *       pagesize 每页条数（可选，默认 50，上限 100）
 * @返回
 *       不传 type：返回三张表全部 id 列表（兼容旧调用）
 *       传 type：  返回 { total, page, pagesize, list }
 *                  list 每项含关键字段（id/name/inuse/description 等）
 */
if (!defined("MANAGE_INTERFACE"))
    exit;

$type = isset($type) ? trim($type) : '';

// 兼容旧调用：不传 type 时返回全部 ID 列表
if (empty($type)) {
    $cfg_things_ids = sql_fetch_column("select tid from cfg_things");
    $cfg_armor_ids = sql_fetch_column("select id from cfg_armor");
    $cfg_goods_ids = sql_fetch_column("select gid from cfg_goods");
    $ret['things'] = $cfg_things_ids;
    $ret['armor'] = $cfg_armor_ids;
    $ret['goods'] = $cfg_goods_ids;
    exit;
}

$tables = array(
    'things' => array(
        'table'  => 'cfg_things',
        'id'     => 'tid',
        'fields' => 'tid, name, inuse, position, description',
    ),
    'armor' => array(
        'table'  => 'cfg_armor',
        'id'     => 'id',
        'fields' => 'id, name, part, type, hero_level, inuse, description',
    ),
    'goods' => array(
        'table'  => 'cfg_goods',
        'id'     => 'gid',
        'fields' => 'gid, name, `group`, value, inuse, description',
    ),
);

if (!isset($tables[$type])) {
    $ret = array('error' => 'unknown_type: ' . $type);
    exit;
}

$t = $tables[$type];
$where = '';
$keyword = isset($keyword) ? trim($keyword) : '';
if (!empty($keyword)) {
    $where = " where name like '%{$keyword}%'";
}
$page = isset($page) ? max(1, intval($page)) : 1;
$pagesize = isset($pagesize) ? min(100, max(10, intval($pagesize))) : 50;
$total = intval(sql_fetch_one_cell("select count(*) from {$t['table']}{$where}"));
$offset = ($page - 1) * $pagesize;
$list = sql_fetch_rows("select {$t['fields']} from {$t['table']}{$where} order by {$t['id']} asc limit {$offset},{$pagesize}");
$ret = array('total' => $total, 'page' => $page, 'pagesize' => $pagesize, 'list' => $list);
?>