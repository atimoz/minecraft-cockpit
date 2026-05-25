; Hook NSIS appelé par Tauri pendant le build Windows.
; Crée et nettoie le raccourci sur le bureau de l'utilisateur.

!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
!macroend
