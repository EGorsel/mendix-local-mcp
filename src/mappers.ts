import { domainmodels } from "mendixmodelsdk";

export interface DomainModelDTO {
    id: string;
    moduleName: string;
    entities: EntityDTO[];
    associations: AssociationDTO[];
}

export interface EntityDTO {
    _type: string;
    name: string;
    documentation: string;
    location: { x: number; y: number };
    attributes: AttributeDTO[];
    generalization?: string;
}

export interface AttributeDTO {
    name: string;
    type: string;
    defaultValue?: string;
    documentation: string;
}

export interface AssociationDTO {
    name: string;
    source: string;
    target: string;
    type: string;
    owner: string;
}

export function mapEntity(entity: domainmodels.Entity): EntityDTO {
    return {
        _type: "Entity",
        name: entity.name,
        documentation: entity.documentation,
        location: { x: entity.location.x, y: entity.location.y },
        attributes: entity.attributes.map(mapAttribute),
        generalization: entity.generalization?.generalizationQualifiedName
    };
}

export function mapAttribute(attr: domainmodels.Attribute): AttributeDTO {
    let typeName = "Unknown";
    try {
        // clean up "DomainModels$StringAttributeType" -> "String"
        typeName = attr.type.structureTypeName.split('$').pop()?.replace('AttributeType', '') || "Unknown";
    } catch (e) { }

    return {
        name: attr.name,
        type: typeName,
        defaultValue: attr.value?.defaultValue,
        documentation: attr.documentation
    };
}

export function mapAssociation(assoc: domainmodels.Association): AssociationDTO {
    let typeName = "Reference";
    try {
        typeName = assoc.type.structureTypeName.split('$').pop() || "Reference";
    } catch (e) { }

    return {
        name: assoc.name,
        source: assoc.parent?.name || "Unknown",
        target: assoc.child?.name || "Unknown",
        type: typeName,
        owner: assoc.owner?.name || "Unknown"
    };
}
