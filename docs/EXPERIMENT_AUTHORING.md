# Authoring an experiment

Open **Authoring studio** from the workspace navigation or experiment library. Create a draft, then work through **Basics**, **Setup**, **Procedure**, and **Review**. Setup uses the existing equipment and stock registries. Procedure commands are constrained to supported add, transfer, mix, reaction, and measurement actions. Review reports blocking errors separately from warnings.

Save drafts in this browser, duplicate definitions for a separate draft ID, or export/import the versioned JSON envelope. Import always becomes a draft and is treated as untrusted plain data. Preview requires a valid definition and opens it through the shared canonical session, `SessionWorkbench`, and 3D `LiquidScene`. Publishing requires validation and adds the definition to this browser's searchable library. A published definition is read-only; duplicate it to edit.

Storage uses browser local storage and can be cleared with browser data. There is no multi-user synchronization, server identity, author roles, or server-side permission enforcement. Do not treat local publication as an authorization boundary or the simulation as a real laboratory procedure.
