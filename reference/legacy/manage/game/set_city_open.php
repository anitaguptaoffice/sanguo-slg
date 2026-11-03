<?php
	//名城与活动开放设置
	//参数列表：
	//set=1 时保存以下参数（均可省略，省略项保持原值）：
	//  luoyang: 洛阳开放 0=禁止 1=开放（mem_state 8）
	//  changan: 长安开放 0=禁止 1=开放（mem_state 112）
	//  bidwar:  全民休战 0=禁用 1=启用（mem_state 113）
	//  start:   休战开始时间戳（mem_state 114）
	//  end:     休战结束时间戳（mem_state 115）
	//返回
	//array[]:当前各开关状态
	if (!defined("MANAGE_INTERFACE")) exit;

	$fields = array(
		8   => '洛阳开放',
		112 => '长安开放',
		113 => '全民休战',
		114 => '休战开始时间戳',
		115 => '休战结束时间戳',
	);

	if (isset($set) && $set) {
		$updates = array();
		if (isset($luoyang) && $luoyang !== '') {
			$luoyang = intval($luoyang);
			if ($luoyang != 0 && $luoyang != 1) exit("luoyang 仅支持 0/1");
			$updates[8] = $luoyang;
		}
		if (isset($changan) && $changan !== '') {
			$changan = intval($changan);
			if ($changan != 0 && $changan != 1) exit("changan 仅支持 0/1");
			$updates[112] = $changan;
		}
		if (isset($bidwar) && $bidwar !== '') {
			$bidwar = intval($bidwar);
			if ($bidwar != 0 && $bidwar != 1) exit("bidwar 仅支持 0/1");
			$updates[113] = $bidwar;
		}
		if (isset($start) && $start !== '') {
			$start = intval($start);
			if ($start < 0) exit("start 必须为非负整数时间戳");
			$updates[114] = $start;
		}
		if (isset($end) && $end !== '') {
			$end = intval($end);
			if ($end < 0) exit("end 必须为非负整数时间戳");
			$updates[115] = $end;
		}
		if (empty($updates)) exit("没有可保存的参数");
		foreach ($updates as $s => $v) {
			sql_query("update mem_state set value='$v' where state='$s'");
		}
		$ret[] = "已保存（" . implode(', ', array_map(function($s) use ($fields, $updates) {
			return $fields[$s] . "=" . $updates[$s];
		}, array_keys($updates))) . "）";
	}

	foreach (array(8, 112, 113, 114, 115) as $s) {
		$cur = sql_fetch_one_cell("select value from mem_state where state=$s");
		$ret[] = $fields[$s] . "=" . $cur;
	}
?>
