# **Business Requirements Document (BRD) & Technical Assessment: AI Solutions Engineer**

**Company Context:** ABC Company (Automotive OEM Division)

**Role Target:** AI Solutions Engineer / AI Integration Specialist

**Assessment Duration:** 6 hours (Take-Home Technical Project)

&nbsp;

## **1\. Executive Summary & Objective**

The objective of this assignment is to evaluate a candidate's ability to design, build, and integrate an end-to-end conversational AI Agent (Chat or Voice) tailored for an enterprise Automotive Original Equipment Manufacturer (OEM) like Mahindra & Mahindra. The agent must dynamically recognize the customer's intent across four distinct stages of the automotive purchase and ownership lifecycle, maintaining real-time bidirectional synchronization with Zoho CRM.

&nbsp;

## **2\. Comprehensive Customer Lifecycle Matrix**

| Lifecycle Stage | User Context & Trigger | Expected AI Agent Logic & Response | Zoho CRM Module & Workflow&nbsp;&nbsp; |
| :---- | :---- | :---- | :---- |
| **1\. New Lead** | Unidentified visitor asking about vehicle models (e.g., XUV700, Thar, Scorpio-N), variant pricing, or features. | Answers specs/pricing query, pitches test drive booking, collects Full Name, Phone, Email, and Preferred City. | Create a new entry in **Leads** module with vehicle model in Custom Field. |
| **2\. Ongoing Pipeline** | Existing prospect providing phone number or deal ID to check test drive confirmation, quotation, or dealer contact. | Fetches active deal status from CRM, informs customer of scheduled time/quote, and updates follow-up preferences. | Search & update record in **Deals / Potentials** module. |
| **3\. Booked Vehicle** | Customer who paid booking amount asking for delivery timeline, VIN allocation, or payment link for balance. | Validates Booking ID or Phone, provides current allocation stage (e.g., In Transit, Dispatch Pending, Delivered). | Retrieve record from custom module / Deal stage marked as **"Closed Won \- Booking Done"**. |
| **4\. Post-Purchase / Service** | Existing owner logging a complaint, asking about service intervals, or booking a periodic maintenance slot. | Gathers registration number, odometer reading, reported issue/service type, and preferred service center location. | Create record in **Cases / Service Tickets** module linked to existing Contact. |

&nbsp;

## **3\. Technical Options & Requirements**

Candidates have to complete **Multistage AI Chat Agent** for their project submission.

### **Multistage AI Chat Agent**

> * **Interface:** Build a responsive frontend interface using React, or Next.js.  
> * **LLM Integration and Orchestration:** Implement tool/function calling to integrate the LLM with backend services, and support multi-step agent workflows where required, using LangChain, LlamaIndex, or direct integration with LLM provider APIs/SDKs.  
> * **Free/Open Source AI Models:** Utilize free API tiers (e.g., Groq API with Llama-3/DeepSeek, Google Gemini API free tier, or local HuggingFace models via Ollama).  
> * **Zoho CRM Integration:** Connect using Zoho CRM OAuth 2.0 REST API or Webhooks to search, create, and update records across Leads, Deals, and Cases.  
> * **State Management:** Maintain conversational history and session state to seamlessly switch context between vehicle discovery and ticket creation.

&nbsp;

## **4\. Setup Instructions for Free Developer Tier (Zoho CRM)**

> 1. Sign up for a free developer account at https://www.zoho.com/crm/.  
> 2. Go to **Zoho API Console** (developer.zoho.com) and create a **Self Client** application.  
> 3. Generate authorization code with scope: ZohoCRM.modules.ALL,ZohoCRM.settings.ALL.  
> 4. Generate refresh\_token, client\_id, and client\_secret to manage Access Tokens inside your backend service.  
> 5. Pre-populate the CRM with mock data:  
   * 1 Existing Lead (e.g., Rajesh Sharma \- Interested in Thar)  
   * 1 Active Deal (e.g., Priya Patel \- Test Drive Scheduled for XUV700)  
   * 1 Booking Record (e.g., Booking ID \#MAH-9921 \- Scorpio-N Z8L)

&nbsp;

## **5\. Candidate Submission Checklist & Deliverables**

> * **Private GitHub Repository:** Clean, modular codebase containing README.md with execution steps, setup scripts, and .env.example.  
> * **Architecture Diagram:** System workflow diagram illustrating intent classification, tool calling, and CRM API integration.  
> * **Demo Video (5–7 Minutes Loom):** Walkthrough demonstrating all 4 stage scenarios in action along with real-time updates inside Zoho CRM dashboard.

&nbsp;

## **6\. Candidate Evaluation Rubric**

| Evaluation Domain | Weight | Key Focus Criteria&nbsp;&nbsp; |
| :---- | :---- | :---- |
| **Agent Design & Function Calling** | **30%** | Accuracy in tool routing, state persistence across turns, edge-case recovery. |
| **Zoho CRM Integration** | **25%** | Robust OAuth 2.0 token management, accurate data mapping across Leads, Deals, and Cases. |
| **Automotive Domain Prompting** | **20%** | Professional OEM brand tone, accurate vehicle jargon, structured gathering of service parameters. |
| **Latency & UI/UX Experience** | **15%** | Low conversational latency, graceful error handling, streaming responses (or voice barge-in handling). |
| **Code Quality & Documentation** | **10%** | Modular code architecture, clean environment variable isolation, unambiguous setup instructions. |

&nbsp;