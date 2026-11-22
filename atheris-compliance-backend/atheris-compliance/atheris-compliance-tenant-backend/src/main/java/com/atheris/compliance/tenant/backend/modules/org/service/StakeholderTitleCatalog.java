package com.atheris.compliance.tenant.backend.modules.org.service;

import java.util.List;

public final class StakeholderTitleCatalog {

    public record TitleDefault(String title, String department, String unit) {}

    public static final List<TitleDefault> TITLES = List.of(
        new TitleDefault("Board of Directors", "Legal & Company Secretariat", "Company Secretariat"),
        new TitleDefault("Branch Manager", "Operations", "Branch Operations"),
        new TitleDefault("Chief Audit Executive", "Internal Audit", "Audit Assurance"),
        new TitleDefault("Chief Compliance Officer", "Compliance", "AML/CFT"),
        new TitleDefault("Chief Executive Officer", "Compliance", "Conduct & Ethics"),
        new TitleDefault("Chief Financial Officer", "Finance & Treasury", "Financial Control"),
        new TitleDefault("Chief Information Security Officer", "Information Technology", "IT Security"),
        new TitleDefault("Chief Risk Officer", "Risk Management", "Enterprise Risk"),
        new TitleDefault("Company Secretary", "Legal & Company Secretariat", "Company Secretariat"),
        new TitleDefault("Compliance Officer", "Compliance", "AML/CFT"),
        new TitleDefault("Data Protection Officer", "Compliance", "Data Protection"),
        new TitleDefault("Financial Controller", "Finance & Treasury", "Financial Control"),
        new TitleDefault("HR Manager", "Human Resources", "HR Operations"),
        new TitleDefault("Head of AML/CFT", "Compliance", "AML/CFT"),
        new TitleDefault("Head of Cash Operations", "Operations", "Cash Management"),
        new TitleDefault("Head of Compliance", "Compliance", "Regulatory Compliance"),
        new TitleDefault("Head of Data Protection", "Compliance", "Data Protection"),
        new TitleDefault("Head of Finance", "Finance & Treasury", "Tax"),
        new TitleDefault("Head of HR", "Human Resources", "HR Operations"),
        new TitleDefault("Head of IT", "Information Technology", "Core Banking"),
        new TitleDefault("Head of Internal Audit", "Internal Audit", "Audit Operations"),
        new TitleDefault("Head of Legal", "Legal & Company Secretariat", "Legal Advisory"),
        new TitleDefault("Head of Operations", "Operations", "Customer Service"),
        new TitleDefault("Head of Regulatory Reporting", "Finance & Treasury", "Regulatory Reporting"),
        new TitleDefault("Head of Risk", "Risk Management", "Credit Risk"),
        new TitleDefault("Head of Treasury", "Finance & Treasury", "Treasury"),
        new TitleDefault("IT Security Manager", "Information Technology", "IT Security"),
        new TitleDefault("Legal Manager", "Legal & Company Secretariat", "Legal Advisory"),
        new TitleDefault("Operations Manager", "Operations", "Customer Service"),
        new TitleDefault("Procurement Manager", "Finance & Treasury", "Procurement"),
        new TitleDefault("Records Manager", "Compliance", "Data Protection"),
        new TitleDefault("Risk Manager", "Risk Management", "Operational Risk"),
        new TitleDefault("Treasury Manager", "Finance & Treasury", "Treasury")
    );

    private StakeholderTitleCatalog() {
    }
}
