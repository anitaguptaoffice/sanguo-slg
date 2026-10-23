<?php
	// GM 后台登录态检查
	if (!defined("MANAGE_INTERFACE")) exit;

	if(!empty($_SESSION['gm_user'])){
		$ret[] = array('status' => 'ok', 'username' => $_SESSION['gm_user']['username']);
	}else{
		$ret[] = array('status' => 'no');
	}
?>
