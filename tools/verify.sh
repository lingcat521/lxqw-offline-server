#!/bin/bash
cd /data/data/com.dsharnessmobile.shell/files/home/.dsh/workspaces/incoming/lxqw
echo "=========== lxqw offline mock: full verification ==========="
echo "--- 1) layer syntax ---"
for f in semantic defaults rules mock screen probe persist iap mail activities annual album furniture handbook decorate handcraft cooking wishing capsule greetcard springcard partycake lottery museumday drawing camera visitor guard diag harden; do
  node -e "new Function(require('fs').readFileSync('new/$f.js','utf8'))" 2>/dev/null && printf "%s:ok " $f || printf "%s:ERR " $f
done; echo
echo "--- 2) served (8089) ---"
for f in mock.js semantic.js defaults.js rules.js screen.js screen.json probe.js persist.js iap.js mail.js activities.js annual.js album.js furniture.js handbook.js decorate.js handcraft.js cooking.js wishing.js capsule.js greetcard.js springcard.js partycake.js lottery.js museumday.js drawing.js camera.js visitor.js guard.js diag.js harden.js; do
  curl -s -m 2 -o /dev/null -w "%{http_code} " http://127.0.0.1:8089/$f
done; echo
echo "--- 3) handler-level contract check (validate.js) ---"
timeout 40 node tools/validate.js > logs/verify_validate.out 2>&1
grep -E "handlers exercised|EXCEPTIONS|CLIENT WARNINGS" logs/verify_validate.out | head -4
grep -A3 "EXCEPTIONS" logs/verify_validate.out | head -4
echo "--- 4) renderer<->payload audit (audit.js) ---"
timeout 40 node tools/audit.js > logs/verify_audit.out 2>&1
echo "  MISSING none: $(grep -c 'MISSING       : none' logs/verify_audit.out) / $(grep -c '^---' logs/verify_audit.out)"
grep -B1 "MISSING" logs/verify_audit.out | grep '^---' | grep -v "$(printf '\t')" | head -1 >/dev/null
echo "--- 5) crash reproduction with the client's REAL renderItem (reprobag2.js) ---"
timeout 25 node tools/reprobag2.js > logs/verify_repro.out 2>&1
grep -E "OpenBag|SHIELDED|no throw" logs/verify_repro.out | tail -5
echo "--- 6) dynamic bag capacity (captest.js) ---"
timeout 20 node tools/captest.js > logs/verify_cap.out 2>&1
grep -E "guideStep|->" logs/verify_cap.out | head -4
echo "--- 7) tutorial loop / client-settings persistence (tuttest.js) ---"
timeout 40 node tools/tuttest.js > logs/verify_tut.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_tut.out)/12"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_tut.out
echo "--- 8) end-to-end: claim mail -> refresh -> data survives (e2eclaim.js) ---"
timeout 60 node tools/e2eclaim.js > logs/verify_e2e.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_e2e.out)/17"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_e2e.out
echo "--- 9) recharge rows + 浇水/兑换 loop (rechargetest.js) ---"
timeout 90 node tools/rechargetest.js > logs/verify_recharge.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_recharge.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_recharge.out
echo "--- 10) annual review rendered by the CLIENT's own builder (annualtest.js) ---"
timeout 60 node tools/annualtest.js > logs/verify_annual.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_annual.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_annual.out
echo "--- 11) screen fitting with the engine's real calculateStageSize (screentest.js) ---"
timeout 60 node tools/screentest.js > logs/verify_screen.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_screen.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_screen.out
echo "--- 12) protocol contract: every field the client reads (contract.js) ---"
timeout 150 node tools/contract.js > logs/verify_contract.out 2>/dev/null
head -1 logs/verify_contract.out
grep -E "MISSING" logs/verify_contract.out | head -5
echo "--- 13) bag/desk length guard (guardtest.js) ---"
timeout 60 node tools/guardtest.js > logs/verify_guard.out 2>/dev/null
grep -E "drops:|mock version|carpet" logs/verify_guard.out | head -4
echo "--- 14) 出行/笔记闭环 + 笔记内容可渲染 (traveltest.js) ---"
timeout 120 node tools/traveltest.js > logs/verify_travel.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_travel.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_travel.out
echo "--- 15) 家具摆放 bench/box/room (furnituretest.js) ---"
timeout 90 node tools/furnituretest.js > logs/verify_furniture.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_furniture.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_furniture.out
echo "--- 16) 图鉴/收藏 + 兑奖 (handbooktest.js) ---"
timeout 90 node tools/handbooktest.js > logs/verify_handbook.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_handbook.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_handbook.out
echo "--- 17) 相册管理 + 小屋装饰 (albumtest.js) ---"
timeout 90 node tools/albumtest.js > logs/verify_album.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_album.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_album.out
echo "--- 18) 祈愿物/印章 手工 (handcrafttest.js) ---"
timeout 90 node tools/handcrafttest.js > logs/verify_handcraft.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_handcraft.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_handcraft.out
echo "--- 19) 每月料理任务 (cookingtest.js) ---"
timeout 90 node tools/cookingtest.js > logs/verify_cooking.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_cooking.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_cooking.out
echo "--- 20) 许愿池 限时活动 (wishtest.js) ---"
timeout 90 node tools/wishtest.js > logs/verify_wish.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_wish.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_wish.out
echo "--- 21) 扭蛋机 限时活动 (capsuletest.js) ---"
timeout 90 node tools/capsuletest.js > logs/verify_capsule.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_capsule.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_capsule.out
echo "--- 22) 贺卡 限时活动 (greetcardtest.js) ---"
timeout 90 node tools/greetcardtest.js > logs/verify_greetcard.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_greetcard.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_greetcard.out
echo "--- 23) 春卡 限时活动 (springcardtest.js) ---"
timeout 90 node tools/springcardtest.js > logs/verify_spring.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_spring.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_spring.out
echo "--- 24) 蛋糕派对 限时活动 (partycaketest.js) ---"
timeout 90 node tools/partycaketest.js > logs/verify_cake.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_cake.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_cake.out
echo "--- 25) 抽奖 (lotterytest.js) ---"
timeout 90 node tools/lotterytest.js > logs/verify_lottery.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_lottery.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_lottery.out
echo "--- 26) 博物馆日探索 限时活动 (museumdaytest.js) ---"
timeout 90 node tools/museumdaytest.js > logs/verify_museum.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_museum.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_museum.out
echo "--- 27) 绘纸 邻居画画 (drawingtest.js) ---"
timeout 120 node tools/drawingtest.js > logs/verify_drawing.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_drawing.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_drawing.out
echo "--- 28) 相机 全景模式 + 保存图片 (cameratest.js) ---"
timeout 90 node tools/cameratest.js > logs/verify_camera.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_camera.out)"
grep -E "FAIL|ALL CHECKS|FAILED" logs/verify_camera.out
echo "--- 29) 明信片图层 (postcardtest.js) ---"
timeout 90 node tools/postcardtest.js > logs/verify_postcardtest.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_postcardtest.out)"
grep -E "FAIL|ALL CHECKS|passed|FAILED" logs/verify_postcardtest.out
echo "--- 30) 出发/回来提示 (noticetest.js) ---"
timeout 120 node tools/noticetest.js > logs/verify_noticetest.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_noticetest.out)"
grep -E "FAIL|ALL CHECKS|passed|FAILED" logs/verify_noticetest.out
echo "--- 31) 故事/羁绊 (storytest.js) ---"
timeout 90 node tools/storytest.js > logs/verify_storytest.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_storytest.out)"
grep -E "FAIL|ALL CHECKS|passed|FAILED" logs/verify_storytest.out
echo "--- 32) 活动日历 (calendartest.js) ---"
timeout 90 node tools/calendartest.js > logs/verify_calendar.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_calendar.out)"
grep -E "FAIL|calendartest:" logs/verify_calendar.out
echo "--- 33) 庭院三叶草 (clovertest.js) ---"
timeout 90 node tools/clovertest.js > logs/verify_clover.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_clover.out)"
grep -E "FAIL|clovertest:" logs/verify_clover.out
echo "--- 34) 邮箱字段防崩 (mailtest.js) ---"
timeout 90 node tools/mailtest.js > logs/verify_mail.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_mail.out)"
grep -E "FAIL|mailtest:" logs/verify_mail.out
echo "--- 35) 出发消耗行李 (consumetest.js) ---"
timeout 90 node tools/consumetest.js > logs/verify_consume.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_consume.out)"
grep -E "FAIL|consumetest:" logs/verify_consume.out
echo "--- 36) 商店刷新/兑换码/旅友投喂 (servicetest.js) ---"
timeout 90 node tools/servicetest.js > logs/verify_service.out 2>/dev/null
echo "  passed: $(grep -c PASS logs/verify_service.out)"
grep -E "FAIL|servicetest:" logs/verify_service.out
echo "--- 37) 合成(开工)死循环 + 熔断 (composeloop.js) ---"
timeout 120 node tools/composeloop.js > logs/verify_composeloop.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_composeloop.out)"
grep -E "FAIL|ALL COMPOSE-LOOP|CHECK" logs/verify_composeloop.out
echo "--- 38) 工作台开工 + 商人库存 (furnituremaketest.js) ---"
timeout 90 node tools/furnituremaketest.js > logs/verify_furnituremake.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_furnituremake.out)"
grep -E "FAIL|ALL FURNITURE-MAKE|CHECK" logs/verify_furnituremake.out
echo "--- 39) 每层都能加载 (layerloadtest.js) ---"
timeout 60 node tools/layerloadtest.js > logs/verify_layerload.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_layerload.out)"
grep -E "FAIL|ALL LAYER-LOAD|CHECK" logs/verify_layerload.out
echo "--- 40) 季节/时段/天气跟真实时钟 (weatherclocktest.js) ---"
timeout 60 node tools/weatherclocktest.js > logs/verify_weatherclock.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_weatherclock.out)"
grep -E "FAIL|ALL CLOCK|CHECK" logs/verify_weatherclock.out
echo "--- 41) 工作台热区(桌子点不动) (benchspot.js) ---"
timeout 60 node tools/benchspot.js > logs/verify_benchspot.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_benchspot.out)"
grep -E "FAIL|ALL BENCH-SPOT|CHECK" logs/verify_benchspot.out
echo "--- 42) 调试/GM 通道 (gmtest.js) ---"
timeout 90 node tools/gmtest.js > logs/verify_gm.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_gm.out)"
grep -E "FAIL|ALL GM|CHECK" logs/verify_gm.out
echo "--- 43) 抽奖券/领奖/礼盒搬运 (raffletest.js) ---"
timeout 90 node tools/raffletest.js > logs/verify_raffle.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_raffle.out)"
grep -E "FAIL|ALL RAFFLE|CHECK" logs/verify_raffle.out
echo "--- 44) 明信片池(目的地/稀有/护符加权) (postcardtest.js) ---"
timeout 90 node tools/postcardtest.js > logs/verify_postcard.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_postcard.out)"
grep -E "FAIL|ALL POSTCARD|CHECK" logs/verify_postcard.out
echo "--- 45) 邻居投喂 (guesttest.js) ---"
timeout 90 node tools/guesttest.js > logs/verify_guest.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_guest.out)"
grep -E "FAIL|ALL GUEST|CHECK" logs/verify_guest.out
echo "--- 46) 旅友笔记/回礼邮件 (friendtest.js) ---"
timeout 90 node tools/friendtest.js > logs/verify_friend.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_friend.out)"
grep -E "FAIL|friendtest:" logs/verify_friend.out
echo "--- 47) 新档起步包 + 手工消耗 (startertest.js) ---"
timeout 60 node tools/startertest.js > logs/verify_starter.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_starter.out)"
grep -E "FAIL|startertest:" logs/verify_starter.out
echo "--- 48) 邮件过期/相册分页/季节商品 (mailseason.js) ---"
timeout 90 node tools/mailseason.js > logs/verify_mailseason.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_mailseason.out)"
grep -E "FAIL|mailseason:" logs/verify_mailseason.out
echo "--- 49) 照片进出礼品盒 (giftboxtest.js) ---"
timeout 90 node tools/giftboxtest.js > logs/verify_giftbox.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_giftbox.out)"
grep -E "FAIL|giftboxtest:" logs/verify_giftbox.out
echo "--- 50) 聚会事件 PartyGo/PartyResult (partytest.js) ---"
timeout 90 node tools/partytest.js > logs/verify_party.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_party.out)"
grep -E "FAIL|partytest:" logs/verify_party.out
echo "--- 51) 墙上的地图(离线活动公告) (travelmaptest.js) ---"
timeout 60 node tools/travelmaptest.js > logs/verify_travelmap.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_travelmap.out)"
grep -E "FAIL|travelmaptest:" logs/verify_travelmap.out
echo "--- 52) 启动竞态重投 (dispracetest.js) ---"
timeout 60 node tools/dispracetest.js > logs/verify_disprace.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_disprace.out)"
grep -E "FAIL|dispracetest:" logs/verify_disprace.out
echo "--- 53) 聚会活动每周任务 (caketasktest.js) ---"
timeout 60 node tools/caketasktest.js > logs/verify_caketask.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_caketask.out)"
grep -E "FAIL|ALL CAKE|CHECK" logs/verify_caketask.out
echo "--- 54) 出发/回家时小屋立即重画 (roomrefreshtest.js) ---"
timeout 90 node tools/roomrefreshtest.js > logs/verify_roomrefresh.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_roomrefresh.out)"
grep -E "FAIL|ALL ROOM|CHECK" logs/verify_roomrefresh.out
echo "--- 55) 播报不再刷屏 + 家具耗时 (noticespamtest.js) ---"
timeout 90 node tools/noticespamtest.js > logs/verify_noticespam.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_noticespam.out)"
grep -E "FAIL|ALL NOTICE|CHECK" logs/verify_noticespam.out
echo "--- 56) 旅行时长按行李算 (tripdurationtest.js) ---"
timeout 60 node tools/tripdurationtest.js > logs/verify_tripduration.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_tripduration.out)"
grep -E "FAIL|ALL TRIP|CHECK" logs/verify_tripduration.out
echo "--- 57) 伴蛙前行 任务/计划 (taskplantest.js) ---"
timeout 90 node tools/taskplantest.js > logs/verify_taskplan.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_taskplan.out)"
grep -E "FAIL|ALL TASK|CHECK" logs/verify_taskplan.out
echo "--- 58) 日历当日任务/节气奖励 (caltasktest.js) ---"
timeout 60 node tools/caltasktest.js > logs/verify_caltask.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_caltask.out)"
grep -E "FAIL|ALL CALENDAR|CHECK" logs/verify_caltask.out
echo "--- 59) 旅友笔记/礼品盒/投喂回礼 (friendgifttest.js) ---"
timeout 90 node tools/friendgifttest.js > logs/verify_friendgift.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_friendgift.out)"
grep -E "FAIL|ALL FRIEND|CHECK" logs/verify_friendgift.out
echo "--- 60) 称号(成就) (achievetest.js) ---"
timeout 60 node tools/achievetest.js > logs/verify_achieve.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_achieve.out)"
grep -E "FAIL|ALL ACHIEVE|CHECK" logs/verify_achieve.out
echo "--- 61) 植物/旅行百科 (encytest.js) ---"
timeout 60 node tools/encytest.js > logs/verify_ency.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_ency.out)"
grep -E "FAIL|ALL ENCY|CHECK" logs/verify_ency.out
echo "--- 62) 故事送礼/回礼邮件 (storygifttest.js) ---"
timeout 90 node tools/storygifttest.js > logs/verify_storygift.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_storygift.out)"
grep -E "FAIL|ALL STORY|CHECK" logs/verify_storygift.out
echo "--- 63) 手工品字段/NaN (handcrafttest.js) ---"
timeout 60 node tools/handcrafttest.js > logs/verify_handcraft.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_handcraft.out)"
grep -E "FAIL|ALL HANDCRAFT|CHECK" logs/verify_handcraft.out
echo "--- 64) 客户端自己摆放/更换家具 (furnishplacetest.js) ---"
timeout 60 node tools/furnishplacetest.js > logs/verify_furnish.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_furnish.out)"
grep -E "FAIL|ALL FURNISH|CHECK" logs/verify_furnish.out
echo "--- 65) 青蛙状态机(居家/饥饿/离家出走/自主出发/访客排期/称号) (frogstatetest.js) ---"
timeout 120 node tools/frogstatetest.js > logs/verify_frogstate.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_frogstate.out)"
grep -E "FAIL|ALL FROG|CHECK" logs/verify_frogstate.out
echo "--- 66) 聚会出门渲染 + 27 篇旅友笔记 (partyawaytest.js) ---"
timeout 90 node tools/partyawaytest.js > logs/verify_partyaway.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_partyaway.out)"
grep -E "FAIL|ALL PARTY|CHECK" logs/verify_partyaway.out
echo "--- 67) 聚会触发链 + 时间机制(访客180~270分/聚会6~18小时) (partyinvitetest.js) ---"
timeout 90 node tools/partyinvitetest.js > logs/verify_partyinvite.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_partyinvite.out)"
grep -E "FAIL|ALL PARTY-INVITE|CHECK" logs/verify_partyinvite.out
echo "--- 68) 投喂回礼/邀约概率/邮箱上限 (guestfeedtest.js) ---"
timeout 120 node tools/guestfeedtest.js > logs/verify_guestfeed.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_guestfeed.out)"
grep -E "FAIL|ALL GUEST-FEED|CHECK" logs/verify_guestfeed.out
echo "--- 69) 花盆种植 + 三叶草农场 (farmtest.js) ---"
timeout 120 node tools/farmtest.js > logs/verify_farm.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_farm.out)"
grep -E "FAIL|ALL FARM|CHECK" logs/verify_farm.out
echo "--- 70) 故事双板块(旅行趣事/节日趣闻) (storiestest.js) ---"
timeout 60 node tools/storiestest.js > logs/verify_stories.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_stories.out)"
grep -E "FAIL|ALL STORIES2|CHECK" logs/verify_stories.out
echo "--- 71) 明信片路径模拟(四区域图/Dijkstra/分级判定) (postroutetest.js) ---"
timeout 120 node tools/postroutetest.js > logs/verify_postroute.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_postroute.out)"
grep -E "FAIL|ALL POSTROUTE|CHECK" logs/verify_postroute.out
echo "--- 72) 呱呱日记(写日记不可打断/内容表/小仓库笔记) (diarytest.js) ---"
timeout 120 node tools/diarytest.js > logs/verify_diary.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_diary.out)"
grep -E "FAIL|ALL DIARY|CHECK" logs/verify_diary.out
echo "--- 73) 节气照片 + 家具风格/材料总量校验 (solarfurntest.js) ---"
timeout 180 node tools/solarfurntest.js > logs/verify_solarfurn.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_solarfurn.out)"
grep -E "FAIL|ALL SOLAR|CHECK" logs/verify_solarfurn.out
echo "--- 74) UI 自检(零代价的实时推送/小屋重画节流/无精灵累积) (uicheck.js) ---"
timeout 200 node tools/uicheck.js > logs/verify_uicheck.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_uicheck.out)"
grep -E "FAIL|ALL UI|CHECK" logs/verify_uicheck.out
echo "--- 75) 友情绘本/旅友笔记(社区配方/聚会结算/金色边框) (friendbooktest.js) ---"
timeout 150 node tools/friendbooktest.js > logs/verify_friendbook.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_friendbook.out)"
grep -E "FAIL|ALL FRIEND|CHECK" logs/verify_friendbook.out
echo "--- 76) 伴蛙前行·动态计划(模板表/惰性重置/抽签保底/跨窗口不串) (planstest.js) ---"
timeout 150 node tools/planstest.js > logs/verify_plans.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_plans.out)"
grep -E "FAIL|ALL PLANS|CHECK" logs/verify_plans.out
echo "--- 77) 点击特效(other_load_touch/解锁与装备) (clickfxtest.js) ---"
timeout 90 node tools/clickfxtest.js > logs/verify_clickfx.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_clickfx.out)"
grep -E "FAIL|ALL CLICK|CHECK" logs/verify_clickfx.out
echo "--- 78) 兑换码(不看时效/每码一次/特效码/520彩蛋) (cdkeytest.js) ---"
timeout 90 node tools/cdkeytest.js > logs/verify_cdkey.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_cdkey.out)"
grep -E "FAIL|ALL CDKEY|CHECK" logs/verify_cdkey.out
echo "--- 79) 季节/昼夜/节气调度(四季/四时段/天气权重/节气窗/限定档期) (seasontest.js) ---"
timeout 90 node tools/seasontest.js > logs/verify_season.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_season.out)"
grep -E "FAIL|ALL SEASON|CHECK" logs/verify_season.out
echo "--- 80) 普通材料来源(嘟嘟 20草/件 + 旅行带回自动放台面) (materialtest.js) ---"
timeout 90 node tools/materialtest.js > logs/verify_material.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_material.out)"
grep -E "FAIL|ALL MATERIAL|CHECK" logs/verify_material.out
echo "--- 81) 旅行地图/地点图鉴(38 地点分四区, 到达或明信片点亮) (maptest.js) ---"
timeout 90 node tools/maptest.js > logs/verify_map.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_map.out)"
grep -E "FAIL|ALL MAP|CHECK" logs/verify_map.out
echo "--- 82) 路径结算引擎(走路径/体力休息/沿途照片去重/护身符限区) (maptest.js 扩展) ---"
timeout 90 node tools/maptest.js > logs/verify_paths.out 2>/dev/null
echo "  passed: $(grep -c 'PASS' logs/verify_paths.out)"
grep -E "FAIL|ALL MAP|CHECK" logs/verify_paths.out
echo "=========== done ==========="
