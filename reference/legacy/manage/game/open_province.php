<?php
	//蛮夷之地开放设置
	//参数列表：
	//value:开放等级(1-5)，不传则只读取当前值
	//  1:仅羌  2:羌+南蛮  3:+山越  4:+乌丸  5:全部开放
	//返回
	//array[]:当前值及设置结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$levels = array(
		1 => '仅开放【羌】',
		2 => '开放【羌】+【南蛮】',
		3 => '开放【羌】+【南蛮】+【山越】',
		4 => '开放【羌】+【南蛮】+【山越】+【乌丸】',
		5 => '全部开放（羌/南蛮/山越/乌丸/匈奴）',
	);

	$cur = intval(sql_fetch_one_cell("select value from mem_state where state=111"));

	if (isset($value) && $value !== '') {
		$value = intval($value);
		if ($value < 1 || $value > 5) exit("value_out_of_range（仅支持 1-5）");
		sql_query("update mem_state set value='$value' where state=111");
		$cur = $value;
		$ret[] = "蛮夷开放等级已设置为 ".$value."：" . $levels[$value];
	} else {
		$ret[] = "当前蛮夷开放等级 ".$cur."：" . (isset($levels[$cur]) ? $levels[$cur] : '未知');
	}
?>
