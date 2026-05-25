"""
UiPath IXP Generative Extraction - Python Integration
======================================================
This script reproduces the 5-step Postman flow for invoking
the UiPath IXP (Unstructured & Complex Documents) project via API.

Steps:
    1. Get Bearer Token
    2. Digitize Document
    3. Get Project ID
    4. Get Extractor ID
    5. Run Extraction

Requirements:
    pip install requests python-dotenv

"""

import requests
import json
import os
import sys

try:
    from dotenv import load_dotenv
    # Loading .env from the same directory as this script
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))
except ImportError:
    print("⚠️  python-dotenv not installed. Install with: pip install python-dotenv")
    print("    (Falling back to OS environment variables only.)")


# ============================================================
# CONFIGURATION — Update these values
# Credentials are read from environment variables (.env file).
# ============================================================
CLIENT_ID     = os.environ.get("UIPATH_CLIENT_ID")  # this is fetched from .env file
CLIENT_SECRET = os.environ.get("UIPATH_CLIENT_SECRET") # this is fetched from .env file

if not CLIENT_ID or not CLIENT_SECRET:
    sys.exit(
        "❌ Missing credentials. Set UIPATH_CLIENT_ID and UIPATH_CLIENT_SECRET "
        "in a .env file next to this script (see .env.example)."
    )

CONFIG = {
    "org_name":      os.environ.get("UIPATH_ORG_NAME", "your-org-name"),
    "tenant_name":   os.environ.get("UIPATH_TENANT_NAME", "your-tenant-name"),
    "base_url":      os.environ.get("UIPATH_BASE_URL", "https://cloud.uipath.com"),
    "client_id":     CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "scope":         "Du.Digitization.Api Du.Extraction.Api Du.Classification.Api Du.DocumentManager.Document Du.Validation.Api",
    "document_path": os.environ.get("DOCUMENT_PATH", "path/to/your/document.pdf"),
    "project_name":  os.environ.get("IXP_PROJECT_NAME", "your-ixp-project-name"),
}
# ============================================================


def get_token(config):
    """
    Step 1: Get Bearer Token using OAuth Client Credentials.
    Token is valid for 1 hour.
    """
    print("\n[Step 1] Getting Bearer Token...")

    url = f"{config['base_url']}/{config['org_name']}/identity_/connect/token"

    payload = {
        "grant_type":    "client_credentials",
        "client_id":     config["client_id"],
        "client_secret": config["client_secret"],
        "scope":         config["scope"],
    }

    response = requests.post(url, data=payload)

    if response.status_code == 200:
        token = response.json()["access_token"]
        print(f"  ✅ Token obtained successfully (expires in {response.json()['expires_in']}s)")
        return token
    else:
        raise Exception(f"  ❌ Failed to get token: {response.status_code} - {response.text}")


def digitize_document(config, token, document_path):
    """
    Step 2: Upload and digitize the document.
    Returns the documentId needed for extraction.
    """
    print(f"\n[Step 2] Digitizing document: {document_path}")

    url = (
        f"{config['base_url']}/{config['org_name']}/{config['tenant_name']}"
        f"/du_/api/framework/projects/00000000-0000-0000-0000-000000000000"
        f"/digitization/start?api-version=1.1"
    )

    headers = {"Authorization": f"Bearer {token}"}

    with open(document_path, "rb") as f:
        files = {"file": (os.path.basename(document_path), f, "application/octet-stream")}
        response = requests.post(url, headers=headers, files=files)

    if response.status_code in (200, 202):
        document_id = response.json().get("documentId")
        print(f"  ✅ Document digitized successfully")
        print(f"     Document ID: {document_id}")
        return document_id
    else:
        raise Exception(f"  ❌ Digitization failed: {response.status_code} - {response.text}")


def get_project_id(config, token, project_name):
    """
    Step 3: Get the Project ID by listing all projects
    and finding the one matching the project_name.
    """
    print(f"\n[Step 3] Getting Project ID for: {project_name}")

    url = (
        f"{config['base_url']}/{config['org_name']}/{config['tenant_name']}"
        f"/du_/api/framework/projects?api-version=1.1"
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        projects = response.json().get("projects", [])
        print(f"  Found {len(projects)} projects total")

        for project in projects:
            if project["name"] == project_name:
                project_id = project["id"]
                project_type = project["type"]
                print(f"  ✅ Project found!")
                print(f"     Project ID:   {project_id}")
                print(f"     Project Type: {project_type}")
                return project_id

        # If project not found, list available IXP projects
        print(f"  ⚠️  Project '{project_name}' not found.")
        print("  Available IXP projects:")
        for p in projects:
            if p["type"] == "IXP":
                print(f"     - {p['name']} ({p['id']})")
        raise Exception(f"Project '{project_name}' not found.")
    else:
        raise Exception(f"  ❌ Failed to get projects: {response.status_code} - {response.text}")


def get_extractor_id(config, token, project_id):
    """
    Step 4: Get the latest Extractor ID for the given project.
    Returns the extractor with the highest version number.
    """
    print(f"\n[Step 4] Getting Extractor ID for project: {project_id}")

    url = (
        f"{config['base_url']}/{config['org_name']}/{config['tenant_name']}"
        f"/du_/api/framework/projects/{project_id}/extractors?api-version=1.1"
    )

    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        extractors = response.json().get("extractors", [])

        if not extractors:
            raise Exception("  ❌ No extractors found. Make sure the project has a published model version.")

        print(f"  Found {len(extractors)} extractor version(s):")
        for e in extractors:
            print(f"     - {e['id']} (version {e.get('projectVersion', 'N/A')}, status: {e.get('status', 'N/A')})")

        # Pick the latest version (highest projectVersion number)
        latest = max(extractors, key=lambda x: x.get("projectVersion", 0))
        extractor_id = latest["id"]
        print(f"  ✅ Using latest extractor: {extractor_id} (version {latest.get('projectVersion')})")
        return extractor_id
    else:
        raise Exception(f"  ❌ Failed to get extractors: {response.status_code} - {response.text}")


def run_extraction(config, token, project_id, extractor_id, document_id):
    """
    Step 5: Run extraction on the digitized document
    using the specified project and extractor.
    Returns the full extraction result.
    """
    print(f"\n[Step 5] Running Extraction...")
    print(f"     Project ID:   {project_id}")
    print(f"     Extractor ID: {extractor_id}")
    print(f"     Document ID:  {document_id}")

    url = (
        f"{config['base_url']}/{config['org_name']}/{config['tenant_name']}"
        f"/du_/api/framework/projects/{project_id}/extractors/{extractor_id}"
        f"/extraction?api-version=1.1"
    )

    headers = {
        "Authorization":  f"Bearer {token}",
        "Content-Type":   "application/json",
    }

    payload = {"documentId": document_id}
    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 200:
        result = response.json()
        print(f"  ✅ Extraction completed successfully!")
        return result
    else:
        raise Exception(f"  ❌ Extraction failed: {response.status_code} - {response.text}")


def parse_extraction_results(extraction_result):
    """
    Helper: Parse and display extracted fields in a readable format.
    """
    print("\n" + "="*60)
    print("EXTRACTION RESULTS SUMMARY")
    print("="*60)

    results_doc = extraction_result.get("extractionResult", {}).get("ResultsDocument", {})
    fields = results_doc.get("Fields", [])
    document_id = extraction_result.get("extractionResult", {}).get("DocumentId", "")
    page_count = results_doc.get("Bounds", {}).get("PageCount", 0)

    print(f"Document ID : {document_id}")
    print(f"Pages       : {page_count}")
    print(f"Fields found: {len(fields)}")
    print()

    extracted_data = {}

    for field in fields:
        field_name = field["FieldName"]
        field_type = field["FieldType"]
        values = field.get("Values", [])

        if field_type == "Table":
            # Handle table fields
            print(f"📋 Table: {field_name}")
            table_rows = []

            for value in values:
                components = value.get("Components", [])
                for component in components:
                    if component["FieldName"] == "Body":
                        for row in component.get("Values", []):
                            row_data = {}
                            for cell in row.get("Components", []):
                                cell_name = cell["FieldName"]
                                cell_values = cell.get("Values", [])
                                if cell_values:
                                    row_data[cell_name] = {
                                        "value":      cell_values[0].get("Value", ""),
                                        "confidence": round(cell_values[0].get("Confidence", 0), 2),
                                        "missing":    cell.get("IsMissing", False)
                                    }
                                else:
                                    row_data[cell_name] = {
                                        "value":      None,
                                        "confidence": 0,
                                        "missing":    True
                                    }
                            table_rows.append(row_data)

            # Print table rows
            for i, row in enumerate(table_rows, 1):
                print(f"  Row {i}:")
                for col, data in row.items():
                    if not data["missing"]:
                        print(f"    {col}: {data['value']} (confidence: {data['confidence']})")
            print()
            extracted_data[field_name] = table_rows

        else:
            # Handle simple fields
            if values:
                value = values[0].get("Value", "")
                confidence = round(values[0].get("Confidence", 0), 2)
                is_missing = field.get("IsMissing", False)
                if not is_missing:
                    print(f"📄 {field_name}: {value} (confidence: {confidence})")
                    extracted_data[field_name] = {"value": value, "confidence": confidence}

    return extracted_data


def save_results(extraction_result, output_path="extraction_results.json"):
    """
    Helper: Save full extraction result to a JSON file.
    """
    with open(output_path, "w") as f:
        json.dump(extraction_result, f, indent=2)
    print(f"\n💾 Full results saved to: {output_path}")


def main():
    print("="*60)
    print("UiPath IXP Generative Extraction - Python Script")
    print("="*60)

    try:
        # Step 1 — Get Token
        token = get_token(CONFIG)

        # Step 2 — Digitize Document
        document_id = digitize_document(CONFIG, token, CONFIG["document_path"])

        # Step 3 — Get Project ID
        project_id = get_project_id(CONFIG, token, CONFIG["project_name"])

        # Step 4 — Get Extractor ID (latest version)
        extractor_id = get_extractor_id(CONFIG, token, project_id)

        # Step 5 — Run Extraction
        extraction_result = run_extraction(CONFIG, token, project_id, extractor_id, document_id)

        # Parse and display results
        extracted_data = parse_extraction_results(extraction_result)

        # Save full raw results to JSON file
        save_results(extraction_result)

        print("\n✅ All steps completed successfully!")
        return extracted_data

    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise


if __name__ == "__main__":
    main()

