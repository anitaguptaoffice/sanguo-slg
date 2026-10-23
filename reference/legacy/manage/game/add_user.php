<?php
	//新增玩家
	//参数列表：
	//passport:账号
	//password:初始密码(>=6位)
	//name:君主名(可选，默认取账号)
	//返回
	//array[]:创建结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$passport = isset($passport) ? trim($passport) : '';
	$password = isset($password) ? trim($password) : '';
	$name = isset($name) ? trim($name) : $passport;

	if (empty($passport)) exit("param_not_exist");
	if (empty($password)) exit("param_not_exist");
	if (strlen($password) < 6) exit("password_too_short");
	if (sql_check("select 1 from test_passport where passport='$passport'")) exit("账号已存在");
	if (sql_check("select 1 from sys_user where passport='$passport' and passtype='testpassport'")) exit("账号已存在");

	//写入登录密码表
	sql_insert("insert into test_passport (passport,password) values ('$passport','$password')");
	//创建玩家（state=3 刚创建角色，登录后进入建城引导，与正常注册一致）
	$uid = sql_insert("insert into sys_user (`passtype`,`passport`,`name`,`group`,`state`,`money`,`regtime`,`domainid`,`honour`) values ('testpassport','$passport','$name','0','3',88888,unix_timestamp(),'0',1000)");
	//会话/在线/引导表
	$sid = rand();
	sql_query("insert into sys_sessions (`uid`,`sid`,`ip`) values ('$uid','$sid','0.0.0.0')");
	sql_query("insert into sys_online (`uid`,`lastupdate`,`onlineupdate`,`onlinetime`) values ('$uid',unix_timestamp(),unix_timestamp(),0)");
	sql_query("insert into sys_user_comming (`uid`,`site_id`,`page_id`,`sub_page_id`) values ('$uid','0','0','0')");

	$ret[] = "玩家创建成功 uid=$uid  账号:$passport 君主名:$name";
?>