<?php
	//玩家列表（分页，按uid升序，包含删号状态玩家）
	//参数列表：
	//page:页码(默认1)
	//keyword:可选，君主名/通行证/uid 模糊搜索
	//返回
	//array[total,page,pagesize,list]
	if (!defined("MANAGE_INTERFACE")) exit;

	$page = isset($page) ? max(1, intval($page)) : 1;
	$pagesize = 10;
	$offset = ($page - 1) * $pagesize;

	$where = "uid > 1000";
	if (!empty($keyword)) {
		$keyword = trim($keyword);
		if (is_numeric($keyword)) {
			$where .= " and (uid='" . intval($keyword) . "' or name like '%$keyword%' or passport like '%$keyword%')";
		} else {
			$where .= " and (name like '%$keyword%' or passport like '%$keyword%')";
		}
	}

	$total = intval(sql_fetch_one_cell("select count(*) from sys_user where $where"));
	$list = sql_fetch_rows("select u.uid,u.name,u.passport,u.state,u.bak_state,u.sex,u.money,u.gift,u.prestige,u.honour,u.regtime,u.lastcid,u.union_id,(select count from sys_goods g where g.uid=u.uid and g.gid=152) as copper from sys_user u where $where order by u.uid asc limit $offset,$pagesize");

	$stateNames = array(0=>'正常',1=>'正常',3=>'新建待建城',4=>'删号',5=>'锁定');
	foreach ($list as &$u) {
		$u['state_name'] = isset($stateNames[intval($u['state'])]) ? $stateNames[intval($u['state'])] : $u['state'];
		$u['regtime_text'] = $u['regtime'] ? date('Y-m-d H:i', $u['regtime']) : '-';
		$u['copper'] = intval($u['copper']);
	}
	unset($u);

	$ret['total'] = $total;
	$ret['page'] = $page;
	$ret['pagesize'] = $pagesize;
	$ret['list'] = $list;
?>