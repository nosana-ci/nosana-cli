export type NosanaNodes = {
  "version": "0.1.0",
  "name": "nosana_nodes",
  "instructions": [
    {
      "name": "register",
      "accounts": [
        {
          "name": "node",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "architectureType",
          "type": "u8"
        },
        {
          "name": "countryCode",
          "type": "u16"
        },
        {
          "name": "cpu",
          "type": "u16"
        },
        {
          "name": "gpu",
          "type": "u16"
        },
        {
          "name": "memory",
          "type": "u16"
        },
        {
          "name": "iops",
          "type": "u16"
        },
        {
          "name": "storage",
          "type": "u16"
        },
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "icon",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        }
      ]
    },
    {
      "name": "audit",
      "accounts": [
        {
          "name": "node",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "audited",
          "type": "bool"
        }
      ]
    },
    {
      "name": "update",
      "accounts": [
        {
          "name": "node",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "architectureType",
          "type": "u8"
        },
        {
          "name": "countryCode",
          "type": "u16"
        },
        {
          "name": "cpu",
          "type": "u16"
        },
        {
          "name": "gpu",
          "type": "u16"
        },
        {
          "name": "memory",
          "type": "u16"
        },
        {
          "name": "iops",
          "type": "u16"
        },
        {
          "name": "storage",
          "type": "u16"
        },
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "icon",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "NodeAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "audited",
            "type": "bool"
          },
          {
            "name": "architecture",
            "type": "u8"
          },
          {
            "name": "country",
            "type": "u16"
          },
          {
            "name": "cpu",
            "type": "u16"
          },
          {
            "name": "gpu",
            "type": "u16"
          },
          {
            "name": "memory",
            "type": "u16"
          },
          {
            "name": "iops",
            "type": "u16"
          },
          {
            "name": "storage",
            "type": "u16"
          },
          {
            "name": "endpoint",
            "type": "string"
          },
          {
            "name": "icon",
            "type": "string"
          },
          {
            "name": "version",
            "type": "string"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "ArchitectureType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Amd64"
          },
          {
            "name": "Arm32v6"
          },
          {
            "name": "Arm32v7"
          },
          {
            "name": "Arm64v8"
          },
          {
            "name": "WindowsAmd64"
          },
          {
            "name": "Ppc64le"
          },
          {
            "name": "S390x"
          },
          {
            "name": "Mips64le"
          },
          {
            "name": "Riscv64"
          },
          {
            "name": "I386"
          },
          {
            "name": "Unknown"
          }
        ]
      }
    },
    {
      "name": "CountryCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "AD"
          },
          {
            "name": "AE"
          },
          {
            "name": "AF"
          },
          {
            "name": "AG"
          },
          {
            "name": "AI"
          },
          {
            "name": "AL"
          },
          {
            "name": "AM"
          },
          {
            "name": "AO"
          },
          {
            "name": "AQ"
          },
          {
            "name": "AR"
          },
          {
            "name": "AS"
          },
          {
            "name": "AT"
          },
          {
            "name": "AU"
          },
          {
            "name": "AW"
          },
          {
            "name": "AX"
          },
          {
            "name": "AZ"
          },
          {
            "name": "BA"
          },
          {
            "name": "BB"
          },
          {
            "name": "BD"
          },
          {
            "name": "BE"
          },
          {
            "name": "BF"
          },
          {
            "name": "BG"
          },
          {
            "name": "BH"
          },
          {
            "name": "BI"
          },
          {
            "name": "BJ"
          },
          {
            "name": "BL"
          },
          {
            "name": "BM"
          },
          {
            "name": "BN"
          },
          {
            "name": "BO"
          },
          {
            "name": "BQ"
          },
          {
            "name": "BR"
          },
          {
            "name": "BS"
          },
          {
            "name": "BT"
          },
          {
            "name": "BV"
          },
          {
            "name": "BW"
          },
          {
            "name": "BY"
          },
          {
            "name": "BZ"
          },
          {
            "name": "CA"
          },
          {
            "name": "CC"
          },
          {
            "name": "CD"
          },
          {
            "name": "CF"
          },
          {
            "name": "CG"
          },
          {
            "name": "CH"
          },
          {
            "name": "CI"
          },
          {
            "name": "CK"
          },
          {
            "name": "CL"
          },
          {
            "name": "CM"
          },
          {
            "name": "CN"
          },
          {
            "name": "CO"
          },
          {
            "name": "CR"
          },
          {
            "name": "CU"
          },
          {
            "name": "CV"
          },
          {
            "name": "CW"
          },
          {
            "name": "CX"
          },
          {
            "name": "CY"
          },
          {
            "name": "CZ"
          },
          {
            "name": "DE"
          },
          {
            "name": "DJ"
          },
          {
            "name": "DK"
          },
          {
            "name": "DM"
          },
          {
            "name": "DO"
          },
          {
            "name": "DZ"
          },
          {
            "name": "EC"
          },
          {
            "name": "EE"
          },
          {
            "name": "EG"
          },
          {
            "name": "EH"
          },
          {
            "name": "ER"
          },
          {
            "name": "ES"
          },
          {
            "name": "ET"
          },
          {
            "name": "FI"
          },
          {
            "name": "FJ"
          },
          {
            "name": "FK"
          },
          {
            "name": "FM"
          },
          {
            "name": "FO"
          },
          {
            "name": "FR"
          },
          {
            "name": "GA"
          },
          {
            "name": "GB"
          },
          {
            "name": "GD"
          },
          {
            "name": "GE"
          },
          {
            "name": "GF"
          },
          {
            "name": "GG"
          },
          {
            "name": "GH"
          },
          {
            "name": "GI"
          },
          {
            "name": "GL"
          },
          {
            "name": "GM"
          },
          {
            "name": "GN"
          },
          {
            "name": "GP"
          },
          {
            "name": "GQ"
          },
          {
            "name": "GR"
          },
          {
            "name": "GS"
          },
          {
            "name": "GT"
          },
          {
            "name": "GU"
          },
          {
            "name": "GW"
          },
          {
            "name": "GY"
          },
          {
            "name": "HK"
          },
          {
            "name": "HM"
          },
          {
            "name": "HN"
          },
          {
            "name": "HR"
          },
          {
            "name": "HT"
          },
          {
            "name": "HU"
          },
          {
            "name": "ID"
          },
          {
            "name": "IE"
          },
          {
            "name": "IL"
          },
          {
            "name": "IM"
          },
          {
            "name": "IN"
          },
          {
            "name": "IO"
          },
          {
            "name": "IQ"
          },
          {
            "name": "IR"
          },
          {
            "name": "IS"
          },
          {
            "name": "IT"
          },
          {
            "name": "JE"
          },
          {
            "name": "JM"
          },
          {
            "name": "JO"
          },
          {
            "name": "JP"
          },
          {
            "name": "KE"
          },
          {
            "name": "KG"
          },
          {
            "name": "KH"
          },
          {
            "name": "KI"
          },
          {
            "name": "KM"
          },
          {
            "name": "KN"
          },
          {
            "name": "KP"
          },
          {
            "name": "KR"
          },
          {
            "name": "KW"
          },
          {
            "name": "KY"
          },
          {
            "name": "KZ"
          },
          {
            "name": "LA"
          },
          {
            "name": "LB"
          },
          {
            "name": "LC"
          },
          {
            "name": "LI"
          },
          {
            "name": "LK"
          },
          {
            "name": "LR"
          },
          {
            "name": "LS"
          },
          {
            "name": "LT"
          },
          {
            "name": "LU"
          },
          {
            "name": "LV"
          },
          {
            "name": "LY"
          },
          {
            "name": "MA"
          },
          {
            "name": "MC"
          },
          {
            "name": "MD"
          },
          {
            "name": "ME"
          },
          {
            "name": "MF"
          },
          {
            "name": "MG"
          },
          {
            "name": "MH"
          },
          {
            "name": "MK"
          },
          {
            "name": "ML"
          },
          {
            "name": "MM"
          },
          {
            "name": "MN"
          },
          {
            "name": "MO"
          },
          {
            "name": "MP"
          },
          {
            "name": "MQ"
          },
          {
            "name": "MR"
          },
          {
            "name": "MS"
          },
          {
            "name": "MT"
          },
          {
            "name": "MU"
          },
          {
            "name": "MV"
          },
          {
            "name": "MW"
          },
          {
            "name": "MX"
          },
          {
            "name": "MY"
          },
          {
            "name": "MZ"
          },
          {
            "name": "NA"
          },
          {
            "name": "NC"
          },
          {
            "name": "NE"
          },
          {
            "name": "NF"
          },
          {
            "name": "NG"
          },
          {
            "name": "NI"
          },
          {
            "name": "NL"
          },
          {
            "name": "NO"
          },
          {
            "name": "NP"
          },
          {
            "name": "NR"
          },
          {
            "name": "NU"
          },
          {
            "name": "NZ"
          },
          {
            "name": "OM"
          },
          {
            "name": "PA"
          },
          {
            "name": "PE"
          },
          {
            "name": "PF"
          },
          {
            "name": "PG"
          },
          {
            "name": "PH"
          },
          {
            "name": "PK"
          },
          {
            "name": "PL"
          },
          {
            "name": "PM"
          },
          {
            "name": "PN"
          },
          {
            "name": "PR"
          },
          {
            "name": "PS"
          },
          {
            "name": "PT"
          },
          {
            "name": "PW"
          },
          {
            "name": "PY"
          },
          {
            "name": "QA"
          },
          {
            "name": "RE"
          },
          {
            "name": "RO"
          },
          {
            "name": "RS"
          },
          {
            "name": "RU"
          },
          {
            "name": "RW"
          },
          {
            "name": "SA"
          },
          {
            "name": "SB"
          },
          {
            "name": "SC"
          },
          {
            "name": "SD"
          },
          {
            "name": "SE"
          },
          {
            "name": "SG"
          },
          {
            "name": "SH"
          },
          {
            "name": "SI"
          },
          {
            "name": "SJ"
          },
          {
            "name": "SK"
          },
          {
            "name": "SL"
          },
          {
            "name": "SM"
          },
          {
            "name": "SN"
          },
          {
            "name": "SO"
          },
          {
            "name": "SR"
          },
          {
            "name": "SS"
          },
          {
            "name": "ST"
          },
          {
            "name": "SV"
          },
          {
            "name": "SX"
          },
          {
            "name": "SY"
          },
          {
            "name": "SZ"
          },
          {
            "name": "TC"
          },
          {
            "name": "TD"
          },
          {
            "name": "TF"
          },
          {
            "name": "TG"
          },
          {
            "name": "TH"
          },
          {
            "name": "TJ"
          },
          {
            "name": "TK"
          },
          {
            "name": "TL"
          },
          {
            "name": "TM"
          },
          {
            "name": "TN"
          },
          {
            "name": "TO"
          },
          {
            "name": "TR"
          },
          {
            "name": "TT"
          },
          {
            "name": "TV"
          },
          {
            "name": "TW"
          },
          {
            "name": "TZ"
          },
          {
            "name": "UA"
          },
          {
            "name": "UG"
          },
          {
            "name": "UM"
          },
          {
            "name": "US"
          },
          {
            "name": "UY"
          },
          {
            "name": "UZ"
          },
          {
            "name": "VA"
          },
          {
            "name": "VC"
          },
          {
            "name": "VE"
          },
          {
            "name": "VG"
          },
          {
            "name": "VI"
          },
          {
            "name": "VN"
          },
          {
            "name": "VU"
          },
          {
            "name": "WF"
          },
          {
            "name": "WS"
          },
          {
            "name": "YE"
          },
          {
            "name": "YT"
          },
          {
            "name": "ZA"
          },
          {
            "name": "ZM"
          },
          {
            "name": "ZW"
          },
          {
            "name": "Unknown"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ArchitectureUnknown",
      "msg": "This architecture does not exist."
    },
    {
      "code": 6001,
      "name": "CountryCodeUnknown",
      "msg": "This country does not exist."
    },
    {
      "code": 6002,
      "name": "CpuInvalid",
      "msg": "CPU value must be greater than zero"
    },
    {
      "code": 6003,
      "name": "GpuInvalid",
      "msg": "GPU value must be greater than zero"
    },
    {
      "code": 6004,
      "name": "MemoryInvalid",
      "msg": "Memory value must be greater than zero"
    },
    {
      "code": 6005,
      "name": "IopsInvalid",
      "msg": "IOPS value must be greater than zero"
    },
    {
      "code": 6006,
      "name": "StorageInvalid",
      "msg": "Storage value must be greater than zero"
    }
  ]
}

export const NodesIDL: NosanaNodes = {
  "version": "0.1.0",
  "name": "nosana_nodes",
  "instructions": [
    {
      "name": "register",
      "accounts": [
        {
          "name": "node",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "architectureType",
          "type": "u8"
        },
        {
          "name": "countryCode",
          "type": "u16"
        },
        {
          "name": "cpu",
          "type": "u16"
        },
        {
          "name": "gpu",
          "type": "u16"
        },
        {
          "name": "memory",
          "type": "u16"
        },
        {
          "name": "iops",
          "type": "u16"
        },
        {
          "name": "storage",
          "type": "u16"
        },
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "icon",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        }
      ]
    },
    {
      "name": "audit",
      "accounts": [
        {
          "name": "node",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "audited",
          "type": "bool"
        }
      ]
    },
    {
      "name": "update",
      "accounts": [
        {
          "name": "node",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "authority",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "architectureType",
          "type": "u8"
        },
        {
          "name": "countryCode",
          "type": "u16"
        },
        {
          "name": "cpu",
          "type": "u16"
        },
        {
          "name": "gpu",
          "type": "u16"
        },
        {
          "name": "memory",
          "type": "u16"
        },
        {
          "name": "iops",
          "type": "u16"
        },
        {
          "name": "storage",
          "type": "u16"
        },
        {
          "name": "endpoint",
          "type": "string"
        },
        {
          "name": "icon",
          "type": "string"
        },
        {
          "name": "version",
          "type": "string"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "NodeAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "publicKey"
          },
          {
            "name": "audited",
            "type": "bool"
          },
          {
            "name": "architecture",
            "type": "u8"
          },
          {
            "name": "country",
            "type": "u16"
          },
          {
            "name": "cpu",
            "type": "u16"
          },
          {
            "name": "gpu",
            "type": "u16"
          },
          {
            "name": "memory",
            "type": "u16"
          },
          {
            "name": "iops",
            "type": "u16"
          },
          {
            "name": "storage",
            "type": "u16"
          },
          {
            "name": "endpoint",
            "type": "string"
          },
          {
            "name": "icon",
            "type": "string"
          },
          {
            "name": "version",
            "type": "string"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "ArchitectureType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Amd64"
          },
          {
            "name": "Arm32v6"
          },
          {
            "name": "Arm32v7"
          },
          {
            "name": "Arm64v8"
          },
          {
            "name": "WindowsAmd64"
          },
          {
            "name": "Ppc64le"
          },
          {
            "name": "S390x"
          },
          {
            "name": "Mips64le"
          },
          {
            "name": "Riscv64"
          },
          {
            "name": "I386"
          },
          {
            "name": "Unknown"
          }
        ]
      }
    },
    {
      "name": "CountryCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "AD"
          },
          {
            "name": "AE"
          },
          {
            "name": "AF"
          },
          {
            "name": "AG"
          },
          {
            "name": "AI"
          },
          {
            "name": "AL"
          },
          {
            "name": "AM"
          },
          {
            "name": "AO"
          },
          {
            "name": "AQ"
          },
          {
            "name": "AR"
          },
          {
            "name": "AS"
          },
          {
            "name": "AT"
          },
          {
            "name": "AU"
          },
          {
            "name": "AW"
          },
          {
            "name": "AX"
          },
          {
            "name": "AZ"
          },
          {
            "name": "BA"
          },
          {
            "name": "BB"
          },
          {
            "name": "BD"
          },
          {
            "name": "BE"
          },
          {
            "name": "BF"
          },
          {
            "name": "BG"
          },
          {
            "name": "BH"
          },
          {
            "name": "BI"
          },
          {
            "name": "BJ"
          },
          {
            "name": "BL"
          },
          {
            "name": "BM"
          },
          {
            "name": "BN"
          },
          {
            "name": "BO"
          },
          {
            "name": "BQ"
          },
          {
            "name": "BR"
          },
          {
            "name": "BS"
          },
          {
            "name": "BT"
          },
          {
            "name": "BV"
          },
          {
            "name": "BW"
          },
          {
            "name": "BY"
          },
          {
            "name": "BZ"
          },
          {
            "name": "CA"
          },
          {
            "name": "CC"
          },
          {
            "name": "CD"
          },
          {
            "name": "CF"
          },
          {
            "name": "CG"
          },
          {
            "name": "CH"
          },
          {
            "name": "CI"
          },
          {
            "name": "CK"
          },
          {
            "name": "CL"
          },
          {
            "name": "CM"
          },
          {
            "name": "CN"
          },
          {
            "name": "CO"
          },
          {
            "name": "CR"
          },
          {
            "name": "CU"
          },
          {
            "name": "CV"
          },
          {
            "name": "CW"
          },
          {
            "name": "CX"
          },
          {
            "name": "CY"
          },
          {
            "name": "CZ"
          },
          {
            "name": "DE"
          },
          {
            "name": "DJ"
          },
          {
            "name": "DK"
          },
          {
            "name": "DM"
          },
          {
            "name": "DO"
          },
          {
            "name": "DZ"
          },
          {
            "name": "EC"
          },
          {
            "name": "EE"
          },
          {
            "name": "EG"
          },
          {
            "name": "EH"
          },
          {
            "name": "ER"
          },
          {
            "name": "ES"
          },
          {
            "name": "ET"
          },
          {
            "name": "FI"
          },
          {
            "name": "FJ"
          },
          {
            "name": "FK"
          },
          {
            "name": "FM"
          },
          {
            "name": "FO"
          },
          {
            "name": "FR"
          },
          {
            "name": "GA"
          },
          {
            "name": "GB"
          },
          {
            "name": "GD"
          },
          {
            "name": "GE"
          },
          {
            "name": "GF"
          },
          {
            "name": "GG"
          },
          {
            "name": "GH"
          },
          {
            "name": "GI"
          },
          {
            "name": "GL"
          },
          {
            "name": "GM"
          },
          {
            "name": "GN"
          },
          {
            "name": "GP"
          },
          {
            "name": "GQ"
          },
          {
            "name": "GR"
          },
          {
            "name": "GS"
          },
          {
            "name": "GT"
          },
          {
            "name": "GU"
          },
          {
            "name": "GW"
          },
          {
            "name": "GY"
          },
          {
            "name": "HK"
          },
          {
            "name": "HM"
          },
          {
            "name": "HN"
          },
          {
            "name": "HR"
          },
          {
            "name": "HT"
          },
          {
            "name": "HU"
          },
          {
            "name": "ID"
          },
          {
            "name": "IE"
          },
          {
            "name": "IL"
          },
          {
            "name": "IM"
          },
          {
            "name": "IN"
          },
          {
            "name": "IO"
          },
          {
            "name": "IQ"
          },
          {
            "name": "IR"
          },
          {
            "name": "IS"
          },
          {
            "name": "IT"
          },
          {
            "name": "JE"
          },
          {
            "name": "JM"
          },
          {
            "name": "JO"
          },
          {
            "name": "JP"
          },
          {
            "name": "KE"
          },
          {
            "name": "KG"
          },
          {
            "name": "KH"
          },
          {
            "name": "KI"
          },
          {
            "name": "KM"
          },
          {
            "name": "KN"
          },
          {
            "name": "KP"
          },
          {
            "name": "KR"
          },
          {
            "name": "KW"
          },
          {
            "name": "KY"
          },
          {
            "name": "KZ"
          },
          {
            "name": "LA"
          },
          {
            "name": "LB"
          },
          {
            "name": "LC"
          },
          {
            "name": "LI"
          },
          {
            "name": "LK"
          },
          {
            "name": "LR"
          },
          {
            "name": "LS"
          },
          {
            "name": "LT"
          },
          {
            "name": "LU"
          },
          {
            "name": "LV"
          },
          {
            "name": "LY"
          },
          {
            "name": "MA"
          },
          {
            "name": "MC"
          },
          {
            "name": "MD"
          },
          {
            "name": "ME"
          },
          {
            "name": "MF"
          },
          {
            "name": "MG"
          },
          {
            "name": "MH"
          },
          {
            "name": "MK"
          },
          {
            "name": "ML"
          },
          {
            "name": "MM"
          },
          {
            "name": "MN"
          },
          {
            "name": "MO"
          },
          {
            "name": "MP"
          },
          {
            "name": "MQ"
          },
          {
            "name": "MR"
          },
          {
            "name": "MS"
          },
          {
            "name": "MT"
          },
          {
            "name": "MU"
          },
          {
            "name": "MV"
          },
          {
            "name": "MW"
          },
          {
            "name": "MX"
          },
          {
            "name": "MY"
          },
          {
            "name": "MZ"
          },
          {
            "name": "NA"
          },
          {
            "name": "NC"
          },
          {
            "name": "NE"
          },
          {
            "name": "NF"
          },
          {
            "name": "NG"
          },
          {
            "name": "NI"
          },
          {
            "name": "NL"
          },
          {
            "name": "NO"
          },
          {
            "name": "NP"
          },
          {
            "name": "NR"
          },
          {
            "name": "NU"
          },
          {
            "name": "NZ"
          },
          {
            "name": "OM"
          },
          {
            "name": "PA"
          },
          {
            "name": "PE"
          },
          {
            "name": "PF"
          },
          {
            "name": "PG"
          },
          {
            "name": "PH"
          },
          {
            "name": "PK"
          },
          {
            "name": "PL"
          },
          {
            "name": "PM"
          },
          {
            "name": "PN"
          },
          {
            "name": "PR"
          },
          {
            "name": "PS"
          },
          {
            "name": "PT"
          },
          {
            "name": "PW"
          },
          {
            "name": "PY"
          },
          {
            "name": "QA"
          },
          {
            "name": "RE"
          },
          {
            "name": "RO"
          },
          {
            "name": "RS"
          },
          {
            "name": "RU"
          },
          {
            "name": "RW"
          },
          {
            "name": "SA"
          },
          {
            "name": "SB"
          },
          {
            "name": "SC"
          },
          {
            "name": "SD"
          },
          {
            "name": "SE"
          },
          {
            "name": "SG"
          },
          {
            "name": "SH"
          },
          {
            "name": "SI"
          },
          {
            "name": "SJ"
          },
          {
            "name": "SK"
          },
          {
            "name": "SL"
          },
          {
            "name": "SM"
          },
          {
            "name": "SN"
          },
          {
            "name": "SO"
          },
          {
            "name": "SR"
          },
          {
            "name": "SS"
          },
          {
            "name": "ST"
          },
          {
            "name": "SV"
          },
          {
            "name": "SX"
          },
          {
            "name": "SY"
          },
          {
            "name": "SZ"
          },
          {
            "name": "TC"
          },
          {
            "name": "TD"
          },
          {
            "name": "TF"
          },
          {
            "name": "TG"
          },
          {
            "name": "TH"
          },
          {
            "name": "TJ"
          },
          {
            "name": "TK"
          },
          {
            "name": "TL"
          },
          {
            "name": "TM"
          },
          {
            "name": "TN"
          },
          {
            "name": "TO"
          },
          {
            "name": "TR"
          },
          {
            "name": "TT"
          },
          {
            "name": "TV"
          },
          {
            "name": "TW"
          },
          {
            "name": "TZ"
          },
          {
            "name": "UA"
          },
          {
            "name": "UG"
          },
          {
            "name": "UM"
          },
          {
            "name": "US"
          },
          {
            "name": "UY"
          },
          {
            "name": "UZ"
          },
          {
            "name": "VA"
          },
          {
            "name": "VC"
          },
          {
            "name": "VE"
          },
          {
            "name": "VG"
          },
          {
            "name": "VI"
          },
          {
            "name": "VN"
          },
          {
            "name": "VU"
          },
          {
            "name": "WF"
          },
          {
            "name": "WS"
          },
          {
            "name": "YE"
          },
          {
            "name": "YT"
          },
          {
            "name": "ZA"
          },
          {
            "name": "ZM"
          },
          {
            "name": "ZW"
          },
          {
            "name": "Unknown"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ArchitectureUnknown",
      "msg": "This architecture does not exist."
    },
    {
      "code": 6001,
      "name": "CountryCodeUnknown",
      "msg": "This country does not exist."
    },
    {
      "code": 6002,
      "name": "CpuInvalid",
      "msg": "CPU value must be greater than zero"
    },
    {
      "code": 6003,
      "name": "GpuInvalid",
      "msg": "GPU value must be greater than zero"
    },
    {
      "code": 6004,
      "name": "MemoryInvalid",
      "msg": "Memory value must be greater than zero"
    },
    {
      "code": 6005,
      "name": "IopsInvalid",
      "msg": "IOPS value must be greater than zero"
    },
    {
      "code": 6006,
      "name": "StorageInvalid",
      "msg": "Storage value must be greater than zero"
    }
  ]
}