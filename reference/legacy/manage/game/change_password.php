<?php
	//修改玩家密码
	//参数列表：
	//uid:玩家UID
	//old_password:旧密码
	//new_password:新密码(>=6位)
	//返回
	//array[]:修改结果
	if (!defined("MANAGE_INTERFACE")) exit;

	$uid = isset($uid) ? intval($uid) : 0;
	if ($uid <= 1000) exit("uid_invalid");
	$user = sql_fetch_one("select uid,passport,name from sys_user where uid='$uid'");
	if (empty($user)) exit("玩家不存在");

	$old_password = isset($old_password) ? trim($old_password) : '';
	$new_password = isset($new_password) ? trim($new_password) : '';
	if (empty($old_password)) exit("param_not_exist");
	if (empty($new_password)) exit("param_not_exist");
	if (strlen($new_password) < 6) exit("password_too_short");

	$pass = sql_fetch_one("select password from test_passport where passport='".$user['passport']."'");
	if (empty($pass)) exit("该账号无本地密码记录，无法修改");
	if ($pass['password'] != $old_password) exit("旧密码不正确");

	sql_query("update test_passport set password='$new_password' where passport='".$user['passport']."'");
	$ret[] = "玩家 ".$user['name']."(".$user['passport'].") 密码修改成功";
?>