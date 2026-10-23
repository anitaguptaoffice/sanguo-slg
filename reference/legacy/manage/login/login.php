<?php
	// GM 后台登录：校验 adm_user，成功后写入 session
	if (!defined("MANAGE_INTERFACE")) exit;

	$username = isset($_POST['username']) ? $_POST['username'] : (isset($_GET['username']) ? $_GET['username'] : '');
	$pwd = isset($_POST['pwd']) ? $_POST['pwd'] : (isset($_GET['pwd']) ? $_GET['pwd'] : '');

	$user = sql_fetch_rows("select userid,username,nick,`group` from adm_user where username ='$username' and pwd = md5('".stripslashes($pwd)."') and is_unin = 0 limit 1");
	if($user){
		$_SESSION['gm_user'] = $user[0];
		$ret[] = array('status' => 'success', 'username' => $user[0]['username'], 'nick' => $user[0]['nick']);
	}else{
		$ret[] = array('status' => 'failed');
	}
?>
