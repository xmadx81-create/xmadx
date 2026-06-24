@echo off
chcp 65001 >nul
REM 무지출용팔이 클라우드판 — 3D 손님 러시 적용 + 재배포 (더블클릭 실행)
REM 이 .bat 과 apply-3d.js, customer-rush-3d.html 을
REM C:\AI_WORK\무지출용팔이 폴더에 함께 두고 더블클릭하세요.
cd /d "%~dp0"
echo ============================================
echo  무지출용팔이 3D 손님러시 적용 + 재배포
echo ============================================
node apply-3d.js
echo.
echo 끝났습니다. 창을 닫으려면 아무 키나 누르세요.
pause >nul
