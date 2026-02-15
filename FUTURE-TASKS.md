# AI Journaling - Pending Tasks

> This file tracks pending features and bugs. Use SpecKit commands when ready to implement each feature.

---

## 🐛 Bugs to Fix

- [x] **RxDB SC35 Error** - Number fields in indexes need `multipleOf` attribute
  - Fixed in `src/services/db/schemas.ts`
- [ ] **Summary page infinite re-rendering** - Investigate and fix

---

## 🚀 Features - Ready for SpecKit

### Authentication & Security

**Nuke salt when password forgotten:**
```
/speckit.specify On the password screen, add option to reset/nuke the encryption salt when the user forgets their password. Should require confirmation and warn about data loss.
```

**API key validation on login:**
```
/speckit.specify After login, if OpenRouter API key is missing or expired, show a setup modal explaining how to get and configure an API key.
```

---

### Settings Page

**Model selection for summarizer:**
```
/speckit.specify Add AI model selection dropdown in settings for the summarizer. Persist selection and use when generating summaries.
```


**Summarizer prompt settings:**
```
/speckit.specify Allow users to customize the prompt used for generating daily summaries.
```


---

### Chat Improvements

**Model selector per chat:**
```
/speckit.specify Add model selection dropdown in the chat interface. Selection should persist across sessions stored in settings where you can also change the default model. Follow the same approach we did for the summarizer and add the same model selector icon next to the generate summary button. It should be a small icon that opens a popup with the model selection combobox.
```

---

### Navigation & UX

**Day navigation arrows:**
```
/speckit.specify Add previous/next day arrow buttons to navigate between days. Unify the Today and Past days views to have consistent Summary and Chat tabs with day navigation arrows.
```

**Calendar popup on date click:**
```
/speckit.specify When clicking the date in the top bar, show a calendar popup to quickly navigate to any day.
```

---

### Future Ideas

- [ ] Monthly summary aggregation
- [ ] Handle app close during operations (prevent data loss)
- [ ] Welcome message / onboarding flow

---

## 📝 Summary Refactor Notes

> **Clarification needed:** The summary should return plain markdown text, not structured objects. Groups (journal, insights, health, dreams) should be flexible/liquid - determined by the AI based on content, not hardcoded schema types.

This requires:
1. Update summary schema to store raw markdown instead of structured sections
2. Update summarizer prompt to return markdown without objects
3. Update UI to render markdown directly

---

## 📋 How to Use SpecKit for These Features

```bash
# 1. Pick a feature from above
# 2. Run the specify command with your AI assistant
/speckit.specify <description from above>

# 3. Follow the workflow
/speckit.plan     # Define technical approach
/speckit.tasks    # Generate task list
/speckit.implement # Build it!
```

> [!TIP]
> Work on one feature at a time. Each `/speckit.specify` creates a new branch.




--- manually added

/speckit.specify When chatting with the AI it should be able to query over the user's journal data and return relevant context for the conversation from any chat.



add vercel deployment








------- Revision 7 feb
- Content or title should not be mandatory, maybe title should not be mandatory or we should even remove it entirely
- Notes should be faster to write

- The summary should take into aaccount notes + messages




- Reorganize notes, will pick up notes and messages and came up with notes from them, removing the other ones (do not remove entirely from the DB mark as deleted)

- Entries is not taking into account notes just messages.

- when searching it should go to the message / note, but now it goes to the day4

the background of some modals is not dark




---



fix rxdb dev errors: 
- [] Error message: Fields of type number/integer that are used in an index, must have set the multipleOf attribute in the schema Error code: SC35 Find out more about this error here: https://rxdb.info/errors.html?console=errors#SC35 -------------------- Parameters: index: "createdAt" field: "createdAt" schema: { "version": 0, "primaryKey": "id", "type": "object", "properties": { "id": { "type": "string", "maxLength": 10 }, "createdAt": { "type": "number" }, "updatedAt": { "type": "number" }, "timezone": { "type": "string", "maxLength": 50 }, "hasSummary": { "type": "boolean" } }, "required": [ "id", "createdAt", "updatedAt", "timezone", "hasSummary" ], "indexes": [ "createdAt", "hasSummary" ] }
- [] The other error

- Button to Nuke current salt, if forgotten password
- Welcome message
  - Set password
  - Confirm the password is saved
  - Set open router api-key and explain about this

- Settings 
  - modify open router api key
  - Modify initial chat prompt
  - Nuke session
  - import/export all data
  - Summariser settings 
    - Prompt of the summariser

- Monthly summary?
  - 

- What if you close the app while something is running you will lost the data right?






DONE? /speckit.clarify When the user enters the app with the password either in the first login or after closing the app, if the openrouter apikey is not added or is expired, show a message to Set open router api-key and explain how it works like it is 

/speckit.specify Add model selection to settings, you can modify the model of the summariser 
/speckit.specify In the chat there will be a selector to select the model of the chat. It will persist for every chat session so we will have to save it somewhere.


/speckit.specify On the password screen if the user forgot the password he should have an option to nuke the current salt
/speckit.specify On the password screen if the user forgot the password he should have an option to nuke the current salt

- The summary page has a problem of inifinte re-rendering
/speckit.clarify The summary response and saved should be plain text. The groups (journal,insights,helath and dreams) should be liquid and not specified as hardcoded or even data types. So the summariser prompt should look any group of data as those examples and return a markdown code without the object. That way the summariser is more flexible and can adapt to any group of data. 


/speckit.clarify I should be able to move to the previous/next day using arrow buttons when in the today chat. We could join together the past days vs today page so we also have the summary and chat tabs and move between days with the arrows. Also want to add that when you click in the date on that top bar the calendar is shown. 





- Modo notes?
- Guardar texto introducido
- Chat writing first to engage the user or follow journaling approaches.





---
add search by keyword, so the search also look database keywords.

add note list filtering and search in the entries menu


THE ERRORS DONT SHOW PROPERLY 
streaming-connection.ts:179  POST https://openrouter.ai/api/v1/chat/completions 429 (Too Many Requests)


